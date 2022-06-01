## Mark S3 Files Public Script

Node script to restore all assets within a folder for a user by updating the S3 file's ACL to public-read

```bash
node script.js <user_id> <folder_id> <mfaCode>
```

## Environment Variables

```
AWS_MFA_DEVICE_ARN=<the MFA device for the AWS account you're using>
AWS_PROD_ROLE_ARN=<the ARN for prod cross-account role>
```
