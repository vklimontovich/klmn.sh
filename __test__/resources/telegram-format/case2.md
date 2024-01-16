The 'SyntaxError: Unexpected token 'export'' error occurs because Node.js's `vm` module doesn't natively support ES6 `import/export` syntax.

To get around this, you can use Babel to transform your code from ES6 to CommonJS. Here's a simple example of how you can do this:

```javascript
const fs = require('fs');
const vm = require('vm');
const babel = require('@babel/core');

const code = fs.readFileSync('./myModule.js', 'utf8');
const transformed = babel.transformSync(code, {
    presets: ['@babel/preset-env']
});

// Now we can use the transformed code
const script = new vm.Script(transformed.code);

const context = { module: {}, exports: {}, require: require };
vm.createContext(context); // Create a context
script.runInNewContext(context); // Run the script in the new context

console.log(Object.keys(context.module.exports)); // Output: [ 'foo', 'bar' ]
```

This code reads the JavaScript file (myModule.js) as a string, transforms it with Babel to convert `import/export` to `require/module.exports`, and then uses Node.js's `vm` module to run the code in a new context. This new context has its own `module` and `exports` objects, which we can then inspect to see what has been exported.

Please note that you'll need to install Babel and the Babel preset for Node.js:

```bash
npm install --save-dev @babel/core @babel/preset-env
```

Again, this approach should be used with caution due to the security and maintainability concerns associated with using `eval` or `vm` to run code.