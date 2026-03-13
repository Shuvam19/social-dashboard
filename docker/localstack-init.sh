#!/bin/bash
set -e

echo "Creating S3 bucket for social-dashboard..."

awslocal s3 mb s3://social-dashboard-uploads

# Configure CORS so the browser can PUT files directly
awslocal s3api put-bucket-cors --bucket social-dashboard-uploads --cors-configuration '{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3600
    }
  ]
}'

# Make bucket publicly readable so uploaded file URLs are accessible
awslocal s3api put-bucket-policy --bucket social-dashboard-uploads --policy '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::social-dashboard-uploads/*"
    }
  ]
}'

echo "S3 bucket 'social-dashboard-uploads' created and configured successfully."
