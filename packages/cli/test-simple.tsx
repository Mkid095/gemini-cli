#!/usr/bin/env node

import { render } from 'ink';
import React, { useState } from 'react';
import { Box, Text } from 'ink';

function SimpleTest() {
  const [count, setCount] = useState(0);
  
  // This should not cause infinite re-renders
  React.useEffect(() => {
    const timer = setInterval(() => {
      setCount(c => c + 1);
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);
  
  return (
    <Box flexDirection="column">
      <Text color="green">✅ Simple Test - No Rendering Loop</Text>
      <Text color="blue">Counter: {count}</Text>
      <Text color="gray">If you see this updating every second without loops, the fix worked!</Text>
    </Box>
  );
}

console.log('🧪 Testing for rendering loop...');
render(<SimpleTest />); 