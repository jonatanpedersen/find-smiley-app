export default {
  port: process.env.port,
  mongodb: {
    connectionString: process.env.MONGODB_URI
  }
}
