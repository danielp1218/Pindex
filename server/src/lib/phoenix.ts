// Arize Phoenix tracing disabled for now due to package compatibility issues
// To enable: npm install @arizeai/openinference-instrumentation-openai @opentelemetry/api @opentelemetry/sdk-trace-node @opentelemetry/exporter-trace-otlp-http

export function setupTracing() {
  if (process.env.PHOENIX_ENDPOINT) {
    console.log('⚠ Phoenix tracing not configured - install deps to enable');
  }
}
