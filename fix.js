const fs = require('fs');
['en', 'ur', 'ru'].forEach(lang => {
  const file = './src/messages/' + lang + '.json';
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/\"totalRows\": \"([^\"]+)\"[\r\n\s]*\"totalRows\": \"[^\"]+\",/g, '\"totalRows\": \"$1\",');
  fs.writeFileSync(file, content);
  
  try {
    JSON.parse(content);
    console.log(file + ' is now valid JSON!');
  } catch(e) {
    console.error(file + ' is still INVALID: ' + e.message);
  }
});
