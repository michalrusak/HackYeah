export default {
  "^/api(?:/|$)": {
    target: process.env.API_URL ?? "http://localhost:3000",
    changeOrigin: true,
  },
};
