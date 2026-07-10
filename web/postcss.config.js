import autoprefixer from 'autoprefixer';
import tailwindcss from 'tailwindcss';

export default {
  plugins: [
    tailwindcss({ config: new URL('./tailwind.config.js', import.meta.url).pathname }),
    autoprefixer(),
  ],
};
