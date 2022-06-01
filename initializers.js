import { PutObjectAclCommand } from "@aws-sdk/client-s3";

export const initializeUpdateObjectACL =
  (s3) =>
  async ({ asset_id, user_id, filename }) => {
    try {
      await s3.send(
        new PutObjectAclCommand({
          Bucket: process.env.AWS_BUCKET_ASSET_FILES,
          Key: `${asset_id}/${user_id}/${filename}`,
          ACL: "public-read",
        })
      );
    } catch (e) {
      return { error: e.message, asset_id };
    }
    return { asset_id };
  };
