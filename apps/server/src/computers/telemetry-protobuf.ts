import { parse } from 'protobufjs';

// Wire-compatible projection of OpenTelemetry proto v1.9.0 (Apache-2.0):
// https://github.com/open-telemetry/opentelemetry-proto/tree/v1.9.0/opentelemetry/proto
// Omitted fields (events, links, exemplars, nested values, schema URLs) are never relayed.
const schema = `syntax = "proto3";
message AnyValue { string stringValue = 1; bool boolValue = 2; int64 intValue = 3; double doubleValue = 4; }
message KeyValue { string key = 1; AnyValue value = 2; }
message Resource { repeated KeyValue attributes = 1; }
message ExportTracesServiceRequest { repeated ResourceSpans resourceSpans = 1; }
message ResourceSpans { Resource resource = 1; repeated ScopeSpans scopeSpans = 2; }
message ScopeSpans { repeated Span spans = 2; }
message Status { uint32 code = 3; }
message Span {
  bytes traceId = 1;
  bytes spanId = 2;
  bytes parentSpanId = 4;
  string name = 5;
  uint32 kind = 6;
  fixed64 startTimeUnixNano = 7;
  fixed64 endTimeUnixNano = 8;
  repeated KeyValue attributes = 9;
  Status status = 15;
  fixed32 flags = 16;
}
message ExportMetricsServiceRequest { repeated ResourceMetrics resourceMetrics = 1; }
message ResourceMetrics { Resource resource = 1; repeated ScopeMetrics scopeMetrics = 2; }
message ScopeMetrics { repeated Metric metrics = 2; }
message Metric {
  string name = 1;
  string unit = 3;
  Gauge gauge = 5;
  Sum sum = 7;
  Histogram histogram = 9;
}
message Gauge { repeated NumberDataPoint dataPoints = 1; }
message Sum { repeated NumberDataPoint dataPoints = 1; uint32 aggregationTemporality = 2; bool isMonotonic = 3; }
message Histogram { repeated HistogramDataPoint dataPoints = 1; uint32 aggregationTemporality = 2; }
message NumberDataPoint {
  fixed64 startTimeUnixNano = 2;
  fixed64 timeUnixNano = 3;
  double asDouble = 4;
  sfixed64 asInt = 6;
  repeated KeyValue attributes = 7;
  uint32 flags = 8;
}
message HistogramDataPoint {
  fixed64 startTimeUnixNano = 2;
  fixed64 timeUnixNano = 3;
  fixed64 count = 4;
  double sum = 5;
  repeated fixed64 bucketCounts = 6;
  repeated double explicitBounds = 7;
  repeated KeyValue attributes = 9;
  uint32 flags = 10;
  double min = 11;
  double max = 12;
}`;

const root = parse(schema).root;
export const telemetryProtobuf = {
    metrics: root.lookupType('ExportMetricsServiceRequest'),
    traces: root.lookupType('ExportTracesServiceRequest'),
};
