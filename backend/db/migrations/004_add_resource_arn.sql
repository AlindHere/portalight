-- Add ARN and error_message columns to resources table
ALTER TABLE resources ADD COLUMN arn VARCHAR(500);
ALTER TABLE resources ADD COLUMN error_message TEXT;
