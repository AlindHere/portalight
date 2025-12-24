package services

import (
	"context"
	"fmt"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/lambda"
	"github.com/aws/aws-sdk-go-v2/service/rds"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/sns"
	"github.com/aws/aws-sdk-go-v2/service/sqs"
	"github.com/portalight/backend/internal/models"
)

// DiscoveredResource represents an AWS resource discovered via API
type DiscoveredResource struct {
	ARN          string                 `json:"arn"`
	Type         string                 `json:"type"` // s3, sqs, sns, rds, lambda
	Name         string                 `json:"name"`
	Region       string                 `json:"region"`
	Status       string                 `json:"status"`
	Metadata     map[string]interface{} `json:"metadata"`
	DiscoveredAt time.Time              `json:"discovered_at"`
}

// AWSDiscovery handles discovering existing AWS resources
type AWSDiscovery struct{}

// NewAWSDiscovery creates a new AWS discovery service
func NewAWSDiscovery() *AWSDiscovery {
	return &AWSDiscovery{}
}

// createConfig creates AWS config with the given credentials
func (d *AWSDiscovery) createConfig(ctx context.Context, creds *models.AWSCredentials, region string) (aws.Config, error) {
	return config.LoadDefaultConfig(ctx,
		config.WithRegion(region),
		config.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(
				creds.AccessKeyID,
				creds.SecretAccessKey,
				"",
			),
		),
	)
}

// DiscoverAll discovers all supported resource types
func (d *AWSDiscovery) DiscoverAll(ctx context.Context, creds *models.AWSCredentials, region string) ([]DiscoveredResource, error) {
	var allResources []DiscoveredResource

	// Discover S3 buckets (global, but we still need a region for the API call)
	s3Resources, err := d.DiscoverS3(ctx, creds, region)
	if err == nil {
		allResources = append(allResources, s3Resources...)
	}

	// Discover SQS queues
	sqsResources, err := d.DiscoverSQS(ctx, creds, region)
	if err == nil {
		allResources = append(allResources, sqsResources...)
	}

	// Discover SNS topics
	snsResources, err := d.DiscoverSNS(ctx, creds, region)
	if err == nil {
		allResources = append(allResources, snsResources...)
	}

	// Discover RDS instances
	rdsResources, err := d.DiscoverRDS(ctx, creds, region)
	if err == nil {
		allResources = append(allResources, rdsResources...)
	}

	// Discover Lambda functions
	lambdaResources, err := d.DiscoverLambda(ctx, creds, region)
	if err == nil {
		allResources = append(allResources, lambdaResources...)
	}

	return allResources, nil
}

// DiscoverS3 discovers S3 buckets
func (d *AWSDiscovery) DiscoverS3(ctx context.Context, creds *models.AWSCredentials, region string) ([]DiscoveredResource, error) {
	cfg, err := d.createConfig(ctx, creds, region)
	if err != nil {
		return nil, err
	}

	client := s3.NewFromConfig(cfg)
	result, err := client.ListBuckets(ctx, &s3.ListBucketsInput{})
	if err != nil {
		return nil, fmt.Errorf("failed to list S3 buckets: %w", err)
	}

	var resources []DiscoveredResource
	for _, bucket := range result.Buckets {
		resources = append(resources, DiscoveredResource{
			ARN:          fmt.Sprintf("arn:aws:s3:::%s", *bucket.Name),
			Type:         "s3",
			Name:         *bucket.Name,
			Region:       region, // S3 buckets are regional but ListBuckets is global
			Status:       "active",
			Metadata:     map[string]interface{}{"created": bucket.CreationDate},
			DiscoveredAt: time.Now(),
		})
	}

	return resources, nil
}

// DiscoverSQS discovers SQS queues
func (d *AWSDiscovery) DiscoverSQS(ctx context.Context, creds *models.AWSCredentials, region string) ([]DiscoveredResource, error) {
	cfg, err := d.createConfig(ctx, creds, region)
	if err != nil {
		return nil, err
	}

	client := sqs.NewFromConfig(cfg)
	result, err := client.ListQueues(ctx, &sqs.ListQueuesInput{})
	if err != nil {
		return nil, fmt.Errorf("failed to list SQS queues: %w", err)
	}

	var resources []DiscoveredResource
	for _, queueUrl := range result.QueueUrls {
		// Extract queue name from URL
		name := queueUrl[len(queueUrl)-1:]
		for i := len(queueUrl) - 1; i >= 0; i-- {
			if queueUrl[i] == '/' {
				name = queueUrl[i+1:]
				break
			}
		}

		resources = append(resources, DiscoveredResource{
			ARN:          fmt.Sprintf("arn:aws:sqs:%s:*:%s", region, name),
			Type:         "sqs",
			Name:         name,
			Region:       region,
			Status:       "active",
			Metadata:     map[string]interface{}{"queue_url": queueUrl},
			DiscoveredAt: time.Now(),
		})
	}

	return resources, nil
}

// DiscoverSNS discovers SNS topics
func (d *AWSDiscovery) DiscoverSNS(ctx context.Context, creds *models.AWSCredentials, region string) ([]DiscoveredResource, error) {
	cfg, err := d.createConfig(ctx, creds, region)
	if err != nil {
		return nil, err
	}

	client := sns.NewFromConfig(cfg)
	result, err := client.ListTopics(ctx, &sns.ListTopicsInput{})
	if err != nil {
		return nil, fmt.Errorf("failed to list SNS topics: %w", err)
	}

	var resources []DiscoveredResource
	for _, topic := range result.Topics {
		// Extract topic name from ARN
		arn := *topic.TopicArn
		name := arn
		for i := len(arn) - 1; i >= 0; i-- {
			if arn[i] == ':' {
				name = arn[i+1:]
				break
			}
		}

		resources = append(resources, DiscoveredResource{
			ARN:          arn,
			Type:         "sns",
			Name:         name,
			Region:       region,
			Status:       "active",
			Metadata:     map[string]interface{}{},
			DiscoveredAt: time.Now(),
		})
	}

	return resources, nil
}

// DiscoverRDS discovers RDS instances
func (d *AWSDiscovery) DiscoverRDS(ctx context.Context, creds *models.AWSCredentials, region string) ([]DiscoveredResource, error) {
	cfg, err := d.createConfig(ctx, creds, region)
	if err != nil {
		return nil, err
	}

	client := rds.NewFromConfig(cfg)
	result, err := client.DescribeDBInstances(ctx, &rds.DescribeDBInstancesInput{})
	if err != nil {
		return nil, fmt.Errorf("failed to describe RDS instances: %w", err)
	}

	var resources []DiscoveredResource
	for _, db := range result.DBInstances {
		status := "unknown"
		if db.DBInstanceStatus != nil {
			status = *db.DBInstanceStatus
		}

		metadata := map[string]interface{}{
			"engine":         aws.ToString(db.Engine),
			"engine_version": aws.ToString(db.EngineVersion),
			"instance_class": aws.ToString(db.DBInstanceClass),
			"storage_gb":     db.AllocatedStorage,
			"multi_az":       db.MultiAZ,
		}

		resources = append(resources, DiscoveredResource{
			ARN:          aws.ToString(db.DBInstanceArn),
			Type:         "rds",
			Name:         aws.ToString(db.DBInstanceIdentifier),
			Region:       region,
			Status:       status,
			Metadata:     metadata,
			DiscoveredAt: time.Now(),
		})
	}

	return resources, nil
}

// DiscoverLambda discovers Lambda functions
func (d *AWSDiscovery) DiscoverLambda(ctx context.Context, creds *models.AWSCredentials, region string) ([]DiscoveredResource, error) {
	cfg, err := d.createConfig(ctx, creds, region)
	if err != nil {
		return nil, err
	}

	client := lambda.NewFromConfig(cfg)
	result, err := client.ListFunctions(ctx, &lambda.ListFunctionsInput{})
	if err != nil {
		return nil, fmt.Errorf("failed to list Lambda functions: %w", err)
	}

	var resources []DiscoveredResource
	for _, fn := range result.Functions {
		metadata := map[string]interface{}{
			"runtime":     string(fn.Runtime),
			"memory_mb":   fn.MemorySize,
			"timeout_sec": fn.Timeout,
			"handler":     aws.ToString(fn.Handler),
		}

		resources = append(resources, DiscoveredResource{
			ARN:          aws.ToString(fn.FunctionArn),
			Type:         "lambda",
			Name:         aws.ToString(fn.FunctionName),
			Region:       region,
			Status:       "active",
			Metadata:     metadata,
			DiscoveredAt: time.Now(),
		})
	}

	return resources, nil
}
