import dotenv from "dotenv";
dotenv.config();
import Knex from "knex";
import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";
import { S3Client } from "@aws-sdk/client-s3";
import { initializeUpdateObjectACL } from "./initializers.js";

const db = new Knex({
  client: "mysql",
  connection: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    timezone: "UTC",
    port: process.env.DB_PORT,
  },
  pool: {
    min: 1,
    max: 10,
  },
});

const sts = new STSClient();

const user_id = process.argv[2];
const folder_id = process.argv[3];
const mfaCode = process.argv[4];

const run = async () => {
  const [folder] = await db
    .select("status")
    .from("user_design_asset_folders")
    .where({ folder_id, user_id });

  if (folder?.status === 9) {
    await db("user_design_asset_folders")
      .where({ folder_id })
      .update({ status: 1 });
  }

  const assets = await db("user_design_assets").where({
    user_id,
    folder_id,
    status: 9,
  });

  try {
    const { Credentials } = await sts.send(
      new AssumeRoleCommand({
        TokenCode: mfaCode,
        SerialNumber: process.env.AWS_MFA_DEVICE_ARN,
        RoleArn: process.env.AWS_PROD_ROLE_ARN,
        DurationSeconds: process.env.AWS_ROLE_DURATION,
        RoleSessionName: "S3-Access",
      })
    );

    const s3 = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: Credentials.AccessKeyId,
        secretAccessKey: Credentials.SecretAccessKey,
        sessionToken: Credentials.SessionToken,
        expiration: Credentials.Expiration,
      },
    });

    const updateObjectACLPublic = initializeUpdateObjectACL(s3);

    const promises = assets.map(updateObjectACLPublic);

    const results = await Promise.allSettled(promises);
    const successful = [];
    const failed = [];

    results.forEach(({ value }) =>
      value.error ? failed.push(value) : successful.push(value)
    );

    console.log("FAILED ASSETS", failed);

    await db("user_design_assets")
      .where({ user_id, folder_id })
      .whereIn(
        "asset_id",
        successful.map(({ asset_id }) => asset_id)
      )
      .update({ status: 1 });
  } catch (error) {
    console.log(error);
  }

  await db.destroy();
};

run();
