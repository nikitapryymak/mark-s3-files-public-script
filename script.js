import dotenv from "dotenv";
dotenv.config();
import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";
import { S3Client, PutObjectAclCommand } from "@aws-sdk/client-s3";
import Knex from "knex";

const db = new Knex({
  client: "mysql",
  connection: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    timezone: "UTC",
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

    const promises = assets.map(async (asset) =>
      s3.send(
        new PutObjectAclCommand({
          Bucket: process.env.AWS_BUCKET_ASSET_FILES,
          Key: `${asset.asset_id}/${user_id}/${asset.filename}`,
          ACL: "public-read",
        })
      )
    );

    const results = await Promise.allSettled(promises);
    const failed = [];
    results.forEach(
      ({ status, reason }) =>
        status === "rejected" &&
        failed.push({
          reason,
        })
    );
    console.log(
      "RESULTS",
      results.map((r) => r.status)
    );
    console.log("FAILED ASSETS", failed);
  } catch (error) {
    console.log(error);
  }

  await db.destroy();
};

run();
