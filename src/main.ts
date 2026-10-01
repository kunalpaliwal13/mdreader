import { mount } from 'svelte';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import 'katex/dist/katex.min.css';
import './app.css';
import './schemes.css';
import './preview.css';
import App from './App.svelte';

export default mount(App, { target: document.getElementById('app')! });
