const fs = require("fs");
const path = require("path");
const letterPath = path.join(__dirname, "../assets/letters.txt");
const wordPath = path.join(__dirname, "../assets/words.txt");
const allLetters = fs.readFileSync(letterPath).toString().replace(/\r/g, "").split("\n");
const wordsBuffer = fs.readFileSync(wordPath);
const allWords = wordsBuffer.toString().replace(/\r/g, "").split("\n").filter(str => str.length > 2 && str.length < 8);

const GetGameSetup = () => {
    const letters = allLetters[ Math.round(Math.random() * allLetters.length) ].split(",");
    const possibleAnswers = makeAnagram(letters);
    return {
        letters,
        allWords: possibleAnswers
    }
};
exports.GetGameSetup = GetGameSetup;

const permute = (leafs) => {
    var branches = [];      
    if( leafs.length == 1 ) return leafs;       
    for( var k in leafs ) {
        var leaf = leafs[k];
        permute(leafs.join('').replace(leaf,'').split('')).concat("").map(function(subtree) {
            branches.push([leaf].concat(subtree));
        });
    }
    return branches.map(function(str){return str.join('')});
};
const makeAnagram = (letters) => {
    var allSS = permute(letters);
    let allCombos = [];
    allSS.forEach(str => {
        if(allCombos.includes(str) || !allWords.includes(str)){
            return;
        }
        allCombos.push(str);
    });

    return allCombos
}