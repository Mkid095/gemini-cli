import { startChat } from './src/ui/App.js';

// Mock LocalLLMConfig for testing
const mockModel = {
  provider: 'lm-studio',
  url: 'http://localhost:1234',
  name: 'test-model'
};

console.log('🎨 Testing Modern Next Mavens UI');
console.log('================================');
console.log('');
console.log('✨ Features:');
console.log('• 🎯 Bubble chat interface (user right, AI left)');
console.log('• ⏳ Loading animations and status indicators');
console.log('• 🎨 Beautiful, modern design');
console.log('• ⌨️ Enhanced input with cursor and shortcuts');
console.log('• 📊 Real-time operation summaries');
console.log('• 🔄 Interactive command execution');
console.log('• 🎪 Smooth animations and transitions');
console.log('');
console.log('🚀 Starting the interface...');
console.log('');

// Start the modern chat interface
startChat(mockModel, process.cwd()); 