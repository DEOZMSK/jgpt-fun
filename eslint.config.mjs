import nextVitals from 'eslint-config-next/core-web-vitals';
const config = [{ignores:['work/**','.generated/**','artifacts/**','.next/**']}, ...nextVitals];
export default config;
