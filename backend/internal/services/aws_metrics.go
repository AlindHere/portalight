package services

import (
	"context"
	"fmt"
	"time"

	"sort"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/cloudwatch"
	"github.com/aws/aws-sdk-go-v2/service/cloudwatch/types"
	"github.com/aws/aws-sdk-go-v2/service/rds"
	"github.com/portalight/backend/internal/models"
)

// MetricDataPoint represents a single metric data point
type MetricDataPoint struct {
	Timestamp time.Time `json:"timestamp"`
	Value     float64   `json:"value"`
}

// ResourceMetrics contains metrics for a specific resource
type ResourceMetrics struct {
	ResourceARN  string                       `json:"resource_arn"`
	ResourceType string                       `json:"resource_type"`
	Period       string                       `json:"period"` // 1h, 6h, 24h, 7d
	Metrics      map[string][]MetricDataPoint `json:"metrics"`
	Metadata     map[string]string            `json:"metadata,omitempty"`
	FetchedAt    time.Time                    `json:"fetched_at"`
}

// AWSMetrics handles fetching CloudWatch metrics
type AWSMetrics struct{}

// NewAWSMetrics creates a new AWS metrics service
func NewAWSMetrics() *AWSMetrics {
	return &AWSMetrics{}
}

// createConfig creates AWS config with the given credentials
func (m *AWSMetrics) createConfig(ctx context.Context, creds *models.AWSCredentials, region string) (aws.Config, error) {
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

// GetRDSMetrics fetches metrics for an RDS instance
func (m *AWSMetrics) GetRDSMetrics(ctx context.Context, creds *models.AWSCredentials, region, instanceID, period string) (*ResourceMetrics, error) {
	cfg, err := m.createConfig(ctx, creds, region)
	if err != nil {
		return nil, err
	}

	client := cloudwatch.NewFromConfig(cfg)

	startTime, endTime, periodSeconds := m.getPeriodTimes(period)

	metrics := &ResourceMetrics{
		ResourceARN:  fmt.Sprintf("arn:aws:rds:%s:*:db:%s", region, instanceID),
		ResourceType: "rds",
		Period:       period,
		Metrics:      make(map[string][]MetricDataPoint),
		Metadata:     make(map[string]string),
		FetchedAt:    time.Now(),
	}

	// Fetch RDS Instance Details (Endpoint)
	rdsClient := rds.NewFromConfig(cfg)
	rdsOutput, err := rdsClient.DescribeDBInstances(ctx, &rds.DescribeDBInstancesInput{
		DBInstanceIdentifier: aws.String(instanceID),
	})
	if err == nil && len(rdsOutput.DBInstances) > 0 {
		instance := rdsOutput.DBInstances[0]
		if instance.Endpoint != nil {
			metrics.Metadata["endpoint"] = fmt.Sprintf("%s:%d", *instance.Endpoint.Address, *instance.Endpoint.Port)
			metrics.Metadata["engine"] = *instance.Engine
			metrics.Metadata["status"] = *instance.DBInstanceStatus
		}
		if instance.MasterUsername != nil {
			metrics.Metadata["master_username"] = *instance.MasterUsername
		}
		if instance.EngineVersion != nil {
			metrics.Metadata["engine_version"] = *instance.EngineVersion
		}
	}

	// Fetch CPU, Memory, Connections metrics
	metricNames := []string{"CPUUtilization", "FreeableMemory", "DatabaseConnections", "ReadIOPS", "WriteIOPS"}

	for _, metricName := range metricNames {
		result, err := client.GetMetricStatistics(ctx, &cloudwatch.GetMetricStatisticsInput{
			Namespace:  aws.String("AWS/RDS"),
			MetricName: aws.String(metricName),
			Dimensions: []types.Dimension{
				{Name: aws.String("DBInstanceIdentifier"), Value: aws.String(instanceID)},
			},
			StartTime:  aws.Time(startTime),
			EndTime:    aws.Time(endTime),
			Period:     aws.Int32(periodSeconds),
			Statistics: []types.Statistic{types.StatisticAverage},
		})

		if err == nil && len(result.Datapoints) > 0 {
			dataPoints := make([]MetricDataPoint, len(result.Datapoints))
			for i, dp := range result.Datapoints {
				dataPoints[i] = MetricDataPoint{
					Timestamp: *dp.Timestamp,
					Value:     *dp.Average,
				}
			}
			sort.Slice(dataPoints, func(i, j int) bool {
				return dataPoints[i].Timestamp.Before(dataPoints[j].Timestamp)
			})
			metrics.Metrics[metricName] = dataPoints
		}
	}

	return metrics, nil
}

// GetLambdaMetrics fetches metrics for a Lambda function
func (m *AWSMetrics) GetLambdaMetrics(ctx context.Context, creds *models.AWSCredentials, region, functionName, period string) (*ResourceMetrics, error) {
	cfg, err := m.createConfig(ctx, creds, region)
	if err != nil {
		return nil, err
	}

	client := cloudwatch.NewFromConfig(cfg)

	startTime, endTime, periodSeconds := m.getPeriodTimes(period)

	metrics := &ResourceMetrics{
		ResourceARN:  fmt.Sprintf("arn:aws:lambda:%s:*:function:%s", region, functionName),
		ResourceType: "lambda",
		Period:       period,
		Metrics:      make(map[string][]MetricDataPoint),
		FetchedAt:    time.Now(),
	}

	metricNames := []string{"Invocations", "Duration", "Errors", "Throttles", "ConcurrentExecutions"}

	for _, metricName := range metricNames {
		result, err := client.GetMetricStatistics(ctx, &cloudwatch.GetMetricStatisticsInput{
			Namespace:  aws.String("AWS/Lambda"),
			MetricName: aws.String(metricName),
			Dimensions: []types.Dimension{
				{Name: aws.String("FunctionName"), Value: aws.String(functionName)},
			},
			StartTime:  aws.Time(startTime),
			EndTime:    aws.Time(endTime),
			Period:     aws.Int32(periodSeconds),
			Statistics: []types.Statistic{types.StatisticSum},
		})

		if err == nil && len(result.Datapoints) > 0 {
			dataPoints := make([]MetricDataPoint, len(result.Datapoints))
			for i, dp := range result.Datapoints {
				val := 0.0
				if dp.Sum != nil {
					val = *dp.Sum
				}
				dataPoints[i] = MetricDataPoint{
					Timestamp: *dp.Timestamp,
					Value:     val,
				}
			}
			sort.Slice(dataPoints, func(i, j int) bool {
				return dataPoints[i].Timestamp.Before(dataPoints[j].Timestamp)
			})
			metrics.Metrics[metricName] = dataPoints
		}
	}

	return metrics, nil
}

// GetS3Metrics fetches metrics for an S3 bucket
// Note: S3 storage metrics (BucketSizeBytes, NumberOfObjects) are published DAILY
// and require a minimum period of 86400 seconds (1 day)
func (m *AWSMetrics) GetS3Metrics(ctx context.Context, creds *models.AWSCredentials, region, bucketName, period string) (*ResourceMetrics, error) {
	cfg, err := m.createConfig(ctx, creds, region)
	if err != nil {
		return nil, err
	}

	client := cloudwatch.NewFromConfig(cfg)

	// For S3 daily storage metrics, we need at least 7 days lookback with 1-day granularity
	endTime := time.Now()
	startTime := endTime.Add(-7 * 24 * time.Hour) // Always look back 7 days for S3
	periodSeconds := int32(86400)                 // S3 storage metrics require 1-day period

	metrics := &ResourceMetrics{
		ResourceARN:  fmt.Sprintf("arn:aws:s3:::%s", bucketName),
		ResourceType: "s3",
		Period:       period,
		Metrics:      make(map[string][]MetricDataPoint),
		FetchedAt:    time.Now(),
	}

	// S3 storage metrics - try multiple storage types
	storageTypes := []string{"StandardStorage", "AllStorageTypes"}
	storageMetrics := []string{"BucketSizeBytes", "NumberOfObjects"}

	for _, metricName := range storageMetrics {
		for _, storageType := range storageTypes {
			result, err := client.GetMetricStatistics(ctx, &cloudwatch.GetMetricStatisticsInput{
				Namespace:  aws.String("AWS/S3"),
				MetricName: aws.String(metricName),
				Dimensions: []types.Dimension{
					{Name: aws.String("BucketName"), Value: aws.String(bucketName)},
					{Name: aws.String("StorageType"), Value: aws.String(storageType)},
				},
				StartTime:  aws.Time(startTime),
				EndTime:    aws.Time(endTime),
				Period:     aws.Int32(periodSeconds),
				Statistics: []types.Statistic{types.StatisticAverage},
			})

			if err == nil && len(result.Datapoints) > 0 {
				dataPoints := make([]MetricDataPoint, len(result.Datapoints))
				for i, dp := range result.Datapoints {
					dataPoints[i] = MetricDataPoint{
						Timestamp: *dp.Timestamp,
						Value:     *dp.Average,
					}
				}
				sort.Slice(dataPoints, func(i, j int) bool {
					return dataPoints[i].Timestamp.Before(dataPoints[j].Timestamp)
				})
				metrics.Metrics[metricName] = dataPoints
				break // Found data, stop trying other storage types
			}
		}
	}

	return metrics, nil
}

// GetSQSMetrics fetches metrics for an SQS queue
func (m *AWSMetrics) GetSQSMetrics(ctx context.Context, creds *models.AWSCredentials, region, queueName, period string) (*ResourceMetrics, error) {
	cfg, err := m.createConfig(ctx, creds, region)
	if err != nil {
		return nil, err
	}

	client := cloudwatch.NewFromConfig(cfg)

	startTime, endTime, periodSeconds := m.getPeriodTimes(period)

	metrics := &ResourceMetrics{
		ResourceARN:  fmt.Sprintf("arn:aws:sqs:%s:*:%s", region, queueName),
		ResourceType: "sqs",
		Period:       period,
		Metrics:      make(map[string][]MetricDataPoint),
		FetchedAt:    time.Now(),
	}

	metricNames := []string{"NumberOfMessagesSent", "NumberOfMessagesReceived", "NumberOfMessagesDeleted", "ApproximateNumberOfMessagesVisible", "ApproximateAgeOfOldestMessage"}

	for _, metricName := range metricNames {
		result, err := client.GetMetricStatistics(ctx, &cloudwatch.GetMetricStatisticsInput{
			Namespace:  aws.String("AWS/SQS"),
			MetricName: aws.String(metricName),
			Dimensions: []types.Dimension{
				{Name: aws.String("QueueName"), Value: aws.String(queueName)},
			},
			StartTime:  aws.Time(startTime),
			EndTime:    aws.Time(endTime),
			Period:     aws.Int32(periodSeconds),
			Statistics: []types.Statistic{types.StatisticSum},
		})

		if err == nil && len(result.Datapoints) > 0 {
			dataPoints := make([]MetricDataPoint, len(result.Datapoints))
			for i, dp := range result.Datapoints {
				val := 0.0
				if dp.Sum != nil {
					val = *dp.Sum
				}
				dataPoints[i] = MetricDataPoint{
					Timestamp: *dp.Timestamp,
					Value:     val,
				}
			}
			sort.Slice(dataPoints, func(i, j int) bool {
				return dataPoints[i].Timestamp.Before(dataPoints[j].Timestamp)
			})
			metrics.Metrics[metricName] = dataPoints
		}
	}

	return metrics, nil
}

// GetSNSMetrics fetches metrics for an SNS topic
func (m *AWSMetrics) GetSNSMetrics(ctx context.Context, creds *models.AWSCredentials, region, topicName, period string) (*ResourceMetrics, error) {
	cfg, err := m.createConfig(ctx, creds, region)
	if err != nil {
		return nil, err
	}

	client := cloudwatch.NewFromConfig(cfg)

	startTime, endTime, periodSeconds := m.getPeriodTimes(period)

	metrics := &ResourceMetrics{
		ResourceARN:  fmt.Sprintf("arn:aws:sns:%s:*:%s", region, topicName),
		ResourceType: "sns",
		Period:       period,
		Metrics:      make(map[string][]MetricDataPoint),
		FetchedAt:    time.Now(),
	}

	// SNS metrics
	metricNames := []string{"NumberOfMessagesPublished", "NumberOfNotificationsDelivered", "NumberOfNotificationsFailed", "PublishSize"}

	for _, metricName := range metricNames {
		result, err := client.GetMetricStatistics(ctx, &cloudwatch.GetMetricStatisticsInput{
			Namespace:  aws.String("AWS/SNS"),
			MetricName: aws.String(metricName),
			Dimensions: []types.Dimension{
				{Name: aws.String("TopicName"), Value: aws.String(topicName)},
			},
			StartTime:  aws.Time(startTime),
			EndTime:    aws.Time(endTime),
			Period:     aws.Int32(periodSeconds),
			Statistics: []types.Statistic{types.StatisticSum},
		})

		if err == nil && len(result.Datapoints) > 0 {
			dataPoints := make([]MetricDataPoint, len(result.Datapoints))
			for i, dp := range result.Datapoints {
				val := 0.0
				if dp.Sum != nil {
					val = *dp.Sum
				}
				dataPoints[i] = MetricDataPoint{
					Timestamp: *dp.Timestamp,
					Value:     val,
				}
			}
			sort.Slice(dataPoints, func(i, j int) bool {
				return dataPoints[i].Timestamp.Before(dataPoints[j].Timestamp)
			})
			metrics.Metrics[metricName] = dataPoints
		}
	}

	return metrics, nil
}

// getPeriodTimes returns start time, end time, and period in seconds based on period string

func (m *AWSMetrics) getPeriodTimes(period string) (time.Time, time.Time, int32) {
	endTime := time.Now()
	var startTime time.Time
	var periodSeconds int32

	switch period {
	case "1h":
		startTime = endTime.Add(-1 * time.Hour)
		periodSeconds = 60 // 1 minute granularity
	case "6h":
		startTime = endTime.Add(-6 * time.Hour)
		periodSeconds = 300 // 5 minute granularity
	case "24h":
		startTime = endTime.Add(-24 * time.Hour)
		periodSeconds = 900 // 15 minute granularity
	case "7d":
		startTime = endTime.Add(-7 * 24 * time.Hour)
		periodSeconds = 3600 // 1 hour granularity
	default:
		startTime = endTime.Add(-24 * time.Hour)
		periodSeconds = 900
	}

	return startTime, endTime, periodSeconds
}
