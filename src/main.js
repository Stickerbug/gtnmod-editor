import * as Blockly from 'blockly';
import * as ZhHans from 'blockly/msg/zh-hans';
import { bootstrapGtnModStudio } from './v2Studio.js';

Blockly.setLocale(ZhHans);

const root = document.getElementById('app');
bootstrapGtnModStudio(root);
