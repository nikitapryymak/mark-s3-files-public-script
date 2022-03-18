// import { S3Client, PutObjectAclCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
dotenv.config();
import pkg from "@aws-sdk/client-s3";
import Knex from "knex";
const { S3Client, PutObjectAclCommand } = pkg;

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

const s3 = new S3Client({
  region: process.env.AWS_REGION,
});

const run = async (user_id, folder_id) => {
  const assets = await db("user_design_assets").where({
    user_id,
    folder_id,
    status: 9,
  });

  // send a single request to test

  // const res = await s3.send(
  //   new PutObjectAclCommand({
  //     Bucket: process.env.AWS_BUCKET_ASSET_FILES,
  //     Key: "ezHjM9tiQ8K0e8mBQZwyEQ/146172/bruh.jpg",
  //     ACL: "public-read",
  //   })
  // );

  // console.log(res);

  try {
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

run(146172, 420522);
