package services

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	s3types "github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/aws/aws-sdk-go-v2/service/sns"
	"github.com/aws/aws-sdk-go-v2/service/sqs"
	sqstypes "github.com/aws/aws-sdk-go-v2/service/sqs/types"
	"github.com/aws/smithy-go"
	"github.com/portalight/backend/internal/models"
)

// AWSProvisioner handles AWS resource provisioning
type AWSProvisioner struct{}

// NewAWSProvisioner creates a new AWS provisioner
func NewAWSProvisioner() *AWSProvisioner {
	return &AWSProvisioner{}
}

// createAWSConfig creates an AWS config with the provided credentials
func (p *AWSProvisioner) createAWSConfig(creds *models.AWSCredentials, region string) aws.Config {
	return aws.Config{
		Region: region,
		Credentials: credentials.NewStaticCredentialsProvider(
			creds.AccessKeyID,
			creds.SecretAccessKey,
			"",
		),
	}
}

// ProvisionS3 creates an S3 bucket with the specified configuration
func (p *AWSProvisioner) ProvisionS3(ctx context.Context, name string, config models.S3Config, creds *models.AWSCredentials) (*models.ProvisionResult, error) {
	awsCfg := p.createAWSConfig(creds, config.Region)
	client := s3.NewFromConfig(awsCfg)

	// Create bucket input
	input := &s3.CreateBucketInput{
		Bucket: aws.String(name),
	}

	// Add location constraint for non-us-east-1 regions
	if config.Region != "us-east-1" {
		input.CreateBucketConfiguration = &s3types.CreateBucketConfiguration{
			LocationConstraint: s3types.BucketLocationConstraint(config.Region),
		}
	}

	// Create the bucket
	_, err := client.CreateBucket(ctx, input)
	if err != nil {
		return &models.ProvisionResult{
			Success: false,
			Error:   parseAWSError(err, "S3"),
		}, nil
	}

	// Configure public access block if enabled
	if config.PublicAccessBlocked {
		_, err = client.PutPublicAccessBlock(ctx, &s3.PutPublicAccessBlockInput{
			Bucket: aws.String(name),
			PublicAccessBlockConfiguration: &s3types.PublicAccessBlockConfiguration{
				BlockPublicAcls:       aws.Bool(true),
				BlockPublicPolicy:     aws.Bool(true),
				IgnorePublicAcls:      aws.Bool(true),
				RestrictPublicBuckets: aws.Bool(true),
			},
		})
		if err != nil {
			return &models.ProvisionResult{
				Success: false,
				Error:   fmt.Sprintf("Bucket created but failed to configure public access block: %s", parseAWSError(err, "S3")),
			}, nil
		}
	}

	// Configure versioning if enabled
	if config.Versioning {
		_, err = client.PutBucketVersioning(ctx, &s3.PutBucketVersioningInput{
			Bucket: aws.String(name),
			VersioningConfiguration: &s3types.VersioningConfiguration{
				Status: s3types.BucketVersioningStatusEnabled,
			},
		})
		if err != nil {
			return &models.ProvisionResult{
				Success: false,
				Error:   fmt.Sprintf("Bucket created but failed to enable versioning: %s", parseAWSError(err, "S3")),
			}, nil
		}
	}

	// Configure encryption
	if config.Encryption != "" {
		var sseAlgorithm s3types.ServerSideEncryption
		if config.Encryption == "aws:kms" {
			sseAlgorithm = s3types.ServerSideEncryptionAwsKms
		} else {
			sseAlgorithm = s3types.ServerSideEncryptionAes256
		}

		_, err = client.PutBucketEncryption(ctx, &s3.PutBucketEncryptionInput{
			Bucket: aws.String(name),
			ServerSideEncryptionConfiguration: &s3types.ServerSideEncryptionConfiguration{
				Rules: []s3types.ServerSideEncryptionRule{
					{
						ApplyServerSideEncryptionByDefault: &s3types.ServerSideEncryptionByDefault{
							SSEAlgorithm: sseAlgorithm,
						},
					},
				},
			},
		})
		if err != nil {
			return &models.ProvisionResult{
				Success: false,
				Error:   fmt.Sprintf("Bucket created but failed to configure encryption: %s", parseAWSError(err, "S3")),
			}, nil
		}
	}

	arn := fmt.Sprintf("arn:aws:s3:::%s", name)
	return &models.ProvisionResult{
		Success: true,
		ARN:     arn,
		Region:  config.Region,
	}, nil
}

// ProvisionSQS creates an SQS queue with the specified configuration
func (p *AWSProvisioner) ProvisionSQS(ctx context.Context, name string, config models.SQSConfig, creds *models.AWSCredentials) (*models.ProvisionResult, error) {
	awsCfg := p.createAWSConfig(creds, config.Region)
	client := sqs.NewFromConfig(awsCfg)

	queueName := name
	if config.QueueType == "fifo" {
		if !strings.HasSuffix(queueName, ".fifo") {
			queueName = queueName + ".fifo"
		}
	}

	// Build attributes
	attributes := map[string]string{}

	if config.VisibilityTimeout > 0 {
		attributes[string(sqstypes.QueueAttributeNameVisibilityTimeout)] = fmt.Sprintf("%d", config.VisibilityTimeout)
	}

	if config.MessageRetentionDays > 0 {
		// Convert days to seconds (max 14 days = 1209600 seconds)
		retentionSeconds := config.MessageRetentionDays * 86400
		if retentionSeconds > 1209600 {
			retentionSeconds = 1209600
		}
		attributes[string(sqstypes.QueueAttributeNameMessageRetentionPeriod)] = fmt.Sprintf("%d", retentionSeconds)
	}

	if config.DelaySeconds > 0 {
		attributes[string(sqstypes.QueueAttributeNameDelaySeconds)] = fmt.Sprintf("%d", config.DelaySeconds)
	}

	if config.QueueType == "fifo" {
		attributes[string(sqstypes.QueueAttributeNameFifoQueue)] = "true"
	}

	input := &sqs.CreateQueueInput{
		QueueName:  aws.String(queueName),
		Attributes: attributes,
	}

	result, err := client.CreateQueue(ctx, input)
	if err != nil {
		return &models.ProvisionResult{
			Success: false,
			Error:   parseAWSError(err, "SQS"),
		}, nil
	}

	// Get queue ARN
	attrResult, err := client.GetQueueAttributes(ctx, &sqs.GetQueueAttributesInput{
		QueueUrl:       result.QueueUrl,
		AttributeNames: []sqstypes.QueueAttributeName{sqstypes.QueueAttributeNameQueueArn},
	})
	if err != nil {
		return &models.ProvisionResult{
			Success: true,
			ARN:     *result.QueueUrl, // Use URL as fallback
			Region:  config.Region,
		}, nil
	}

	return &models.ProvisionResult{
		Success: true,
		ARN:     attrResult.Attributes[string(sqstypes.QueueAttributeNameQueueArn)],
		Region:  config.Region,
	}, nil
}

// ProvisionSNS creates an SNS topic with the specified configuration
func (p *AWSProvisioner) ProvisionSNS(ctx context.Context, name string, config models.SNSConfig, creds *models.AWSCredentials) (*models.ProvisionResult, error) {
	awsCfg := p.createAWSConfig(creds, config.Region)
	client := sns.NewFromConfig(awsCfg)

	topicName := name
	if config.TopicType == "fifo" {
		if !strings.HasSuffix(topicName, ".fifo") {
			topicName = topicName + ".fifo"
		}
	}

	input := &sns.CreateTopicInput{
		Name: aws.String(topicName),
	}

	if config.TopicType == "fifo" {
		input.Attributes = map[string]string{
			"FifoTopic": "true",
		}
	}

	result, err := client.CreateTopic(ctx, input)
	if err != nil {
		return &models.ProvisionResult{
			Success: false,
			Error:   parseAWSError(err, "SNS"),
		}, nil
	}

	return &models.ProvisionResult{
		Success: true,
		ARN:     *result.TopicArn,
		Region:  config.Region,
	}, nil
}

// parseAWSError converts AWS errors to user-friendly messages
func parseAWSError(err error, service string) string {
	var apiErr smithy.APIError
	if errors.As(err, &apiErr) {
		code := apiErr.ErrorCode()
		message := apiErr.ErrorMessage()

		switch code {
		// S3 errors
		case "BucketAlreadyExists":
			return "A bucket with this name already exists globally. S3 bucket names must be unique across all AWS accounts."
		case "BucketAlreadyOwnedByYou":
			return "You already own a bucket with this name."
		case "InvalidBucketName":
			return fmt.Sprintf("Invalid bucket name: %s. Bucket names must be 3-63 characters, lowercase, and can contain only letters, numbers, and hyphens.", message)

		// SQS errors
		case "QueueAlreadyExists":
			return "A queue with this name already exists."
		case "QueueNameExists":
			return "A queue with this name already exists with different attributes."

		// SNS errors
		case "TopicLimitExceeded":
			return "You have reached the maximum number of SNS topics for your account."

		// Common errors
		case "InvalidClientTokenId":
			return "Invalid AWS credentials. Please check your Access Key ID."
		case "SignatureDoesNotMatch":
			return "Invalid AWS credentials. Please check your Secret Access Key."
		case "AccessDenied", "AccessDeniedException":
			return fmt.Sprintf("Access denied. Ensure your IAM user has permissions to create %s resources.", service)
		case "UnauthorizedAccess":
			return "Unauthorized access. Please check your AWS credentials and permissions."
		case "InvalidParameterValue":
			return fmt.Sprintf("Invalid parameter: %s", message)
		case "ValidationError":
			return fmt.Sprintf("Validation error: %s", message)
		default:
			return fmt.Sprintf("%s error (%s): %s", service, code, message)
		}
	}

	return fmt.Sprintf("%s error: %s", service, err.Error())
}
