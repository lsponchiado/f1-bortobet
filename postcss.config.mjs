/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    '@tailwindcss/postcss': {}, // Mudança crucial aqui
    'autoprefixer': {},
  },
};

export default config;