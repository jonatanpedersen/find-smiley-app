export default {
  data: process.env.DATA,
  host: process.env.HOST,
  port: process.env.PORT,
  session: {
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true
  },
  github: {
    client_id: process.env.GITHUB_CLIENT_ID,
    client_secret: process.env.GITHUB_CLIENT_SECRET,
    callback_url: process.env.HOST + '/auth/github/callback'
  },
  jwt: {
    secret: process.env.JWT_SECRET
  },
  mongodb: {
    connectionString: process.env.MONGODB
  }
}
