const Store = require('./lib/Store');
let test = {
    a: 0,
    b: {
        c: [
            1,
            2,
            3
        ]
    }
};


Store.increment('directory', 'somerandomstring', 5)
.then(() => {
    return Store.get('directory', 'somerandomstring');
})
.then((result) => {
    console.log(result);
});
