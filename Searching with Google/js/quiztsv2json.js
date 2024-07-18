/**
 * 
 * Take an TSV from the quiz and turn it into JSON setup.
 * 
 * The idea is that the Excel document is arranged such that a given entry is one or more rows,
 * with an indicator of the next entry to begin when the value in column 0 changes
 * 
 * 
 * The first pass through of the TSV file puts the cells into an object that looks like
 *  
 * {
 *  order: [cellA0, cellC0],
 *  cellA0: [
 *    [cellA1, cellA2, cellA3],
 *    [cellB1, cellB2, cellB3]
 *  ],
 *  cellC0: [
 *    [cellC1, cellC2, cellC3],
 *    [cellD1, cellD2, cellD3]
 *  ]
 * }
 * 
 * And then that can be tranformed into an object using a JSON-shaped template object for each
 * 
 * With quiz data, the order matters, so record the order as it comes in (I think it'll be numbers anyway)
 * 
 */


const fs = require('fs');
const { execSync } = require('child_process');
const delimiter = ".";
let configdir = process.env.npm_package_config_loc;
let tsvfilelist = configdir + process.env.npm_package_config_quizTSVset;
let outputLocation = "json/";

let newrecord = "";

const regs = {
  "n": /\n+$/,
  "r": /\r+$/,
  "x": /\.\w{2,4}$/,
  "dot": /^\./,
  "cell": /([^\d]+)(\d*.*)$/,
};

const columns = {
  'area': 0,
  'right': 1,
  'feedback': 2,
  'text': 3,
  'image': 4,
  'alt': 5,
  'bigtext': 6,
  'buttonA': 7,
  'buttonB': 8,
  'notes': 9
}

const ensureExtension = function (string, extension) {
  let newstring = string;
  extension = extension.replace(regs.dot, "");
  var re = new RegExp('/\.' + extension + '$/', "g");
  if (!string.match(re)) {
    newstring += "." + extension;
  }
  return newstring;
}

const tabrep = "%%cTAB%%";
const tabregex = new RegExp(tabrep, 'g');

const addIfNoExtension = function (string, extension) {
  console.log(string);
  if (string.match(regs.x)) {
    console.log("has extension");
    return string;
  }
  console.log("no extension");
  return ensureExtension(string, extension);
}

const noExtension = function (string) {
  return string.replace(regs.x, "");
}

const stripTrailingReturn = function (string) {
  string = string.replace(regs.n, "");
  string = string.replace(regs.r, "");
  return string;
}


/* 
TODO: how to handle arrays? And different lengths of rows maybe

There are some conditions in the quiz data:
Each row is a new pane, but...
- if a given row is a question pane, then 
 - that row has answer button info, and
 - the following row is the result for answer 1 and
 - the row after that is the result for answer 2

So maybe what's needed is a mode shift that resets the relative row and parses it accordingly. 
But in the short term, just bespoke it; on user click just go to the row based on what they clicked

*/

const parseTSV = function (tsvfile) {
  let quizconfig;
  console.log('PARSETSV ' + tsvfile);
  try {
    quizconfig = fs.readFileSync(tsvfile, 'utf8');
  } catch {
    console.log("couldn't read file " + tsvfile);
    return null;
  }

  try {
    //let quiztext = quizconfig.toString();
    // TODO: need to replace INTERIOR newlines (will be inside quotes) with something else
    //quiztext = parseNewlines(quizconfig);
    const rows = splitTSVLines(quizconfig);
    //const rows = quiztext.split("\n");
    let tsvobject = {};
    let row = 0;
    let key;
    let currentNode;
    let currentArray;
    for (let i = 1; i < rows.length; i++) {
      let cells = rows[i].split('\t');
      if (!cells[0]) {
        //continue;
      }
      if (cells[0] !== key) {
        key = cells[0];
        row = 0;
        tsvobject[key] = [[key]];
        currentNode = tsvobject[key];
      } else {
        row++;
        tsvobject[key].push([""]);
      }
      currentArray = currentNode[row];
      for (let j = 1; j < cells.length; j++) {
        let val = cells[j];
        // get rid of a trailing newline
        val = stripTrailingReturn(stripQuotes(val));
        currentArray.push(val);
        if (j === 4) {
          console.log(i + " " + val);
        }
      }
    }
    //console.log("** TSV: ", tsvobject);
    console.log("got tsv");
    return tsvobject;
  } catch {
    console.log("something wrong with TSV syntax/formatting");
    return null;
  }
}

function tsv2Arrays(tsvfile) {
  let arr = [];
  const files = fs.readFileSync(tsvfile, 'utf8').toString().split("\n");
  for (let i in files) {
    let row = files[i].split("\t");
    arr.push(row);
  }
  return arr;
}

function splitTSVLines(str) {
  //TODO: don't split on a tab that is inside quotes
  let sp = str.split("\t");
  let arr = [];
  let ind = 0;
  let row = 0;
  for (let s = 0; s < sp.length; s++) {
    let cell = sp[s];
    if (cell.match(/\xA0/)) {
      cell.replace(/\xA0/, " ");
    }
    if (cell.match(/\n/)) {
      if (!cell.match(/"$/)) {
        // a newline with no quote is a real delimiting newline
        // or if it does have a quote, it's the last one if the quote is *not* at the end
        ind++;
        let lines = sp[s].split("\n");
        arr[ind] = lines[lines.length - 1] + "\t";
        row++;
        continue;
      }
    }
    if (cell.match(/^"/) && !cell.match(/"$/)) {
      // if there are unmatched quotes, consider it a tab inside a cell that got split
      let ss = parseInt(s) + 1;
      let mergedTabLine = cell;
      let nextCell = sp[ss];
      while (!nextCell.match(/"$/) && ss < 100000) {
        console.log(ss);
        mergedTabLine += tabrep + nextCell;
        ss++;
        nextCell = sp[ss];
      }
      mergedTabLine += tabrep + nextCell;
      arr[ind] += mergedTabLine + "\t";
      s = ss;
      console.log("*** unmatched quote: " + mergedTabLine + " skipped to " + s);
      continue;
    }
    arr[ind] += sp[s] + "\t";
  }
  console.log(arr.length);
  return arr;
}

function replaceInnerTab(cell) {
  cell = cell.replace(tabregex, "\t");
  return cell;
}

function stripQuotes(str) {
  if (str.match(/"/)) {
    str = str.replace(/^"(.*)/, "$1");
    str = str.replace(/(.*)"$/, "$1");
    str = str.replace(/""/g, '"');
  }
  /// replace leading & trailing spaces
  str = str.replace(/\s+$/, "");
  str = str.replace(/^\s+/, "");
  return str;
}

function convertRowsToJSON(tsvobject) {
  /* the input tsvobject will look like
    {
      1: [ [A1, B1, C1, D1, E1, F1, G1, H1, I1, J1, K1], [A2, B2, C2, D2, E2, F2, G2, H2, I2, J2, K2] ],
      2: [ [A3, B3, C3, D3, E3, F3, G3, H3, I3, J3, K3], [A4, B4, C4, D4, E4, F4, G4, H4, I4, J4, K4], [A5, B5, C5, D5, E5, F5, G5, H5, I5, J5, K5]],
    }

    where B=page type, C=right/wrong, D=answer leader, E=text, F=image file, G=alt text, H=text callout, I=button 1, J=button 2, K=notes
    if button 1 != 'next' and button 2 != 0, then the next two rows are answers for button 1 and button 2 respectively

    output should be

    "1": [
      "t"[ main text ]: En, 
      "i"[ image, opt ]: {"s":Fn,"a":Gn}
      "c"[ callout text, opt ]: Hn,
      "r"[ which answer is right ]: read C(n+1)
      "l"[ answer "leader", opt ]: Dn
      "a"[ answers, opt ]: [
        In,
        Jn
      ],
      "type": "q"uestion | "r"esponse | "t"ext
    ]
  */



  let jsonobject = { "_order": [], "_review": {}, "_pages": 0 };
  let pagenumber = 0;
  let repeatpagenumber = false;
  let secondanswer = false;
  for (let i in tsvobject) {
    jsonobject[i] = [];
    jsonobject._order.push(i);
    let qnodes = tsvobject[i];
    let jsonq = jsonobject[i];
    for (let j = 0; j < qnodes.length; j++) {
      let node = qnodes[j];
      let nodejson = makePaneFromNode(node);
      if (j === qnodes.length - 1) {
        jsonobject._review = makePaneFromNode(node); // lazy; this makes the review for every one, but the last one sticks
      }
      nodejson.type = "t";
      if (node[columns.buttonA] && node[columns.buttonA] !== 'next') {
        nodejson.type = "q";
        nodejson.a = [
          node[columns.buttonA], node[columns.buttonB]
        ];
        nodejson.r = (qnodes[j + 1][columns.right] === "r") ? 0 : 1;
        secondanswer = false;
      }
      if (node[columns.right]) {
        if(secondanswer) {
          repeatpagenumber = true;
        }
        secondanswer = true;
        nodejson.type = "r";
      } else {
        repeatpagenumber = false;
        secondanswer = false;
      }
      //if(!repeatpagenumber) { // this condition would merge the two answer pages into the same page number
        pagenumber++;
      //}
      nodejson.page = pagenumber;
      jsonq.push(nodejson);
    }
  }
  //console.log(jsonobject);
  jsonobject._pages = pagenumber - 1; // one fewer because the last one is the review;
  return jsonobject;
}

function makePaneFromNode(node) {
  for (let i in node) {
    node[i] = replaceInnerTab(node[i]);
  }
  let nodejson = {
    "t": node[columns.text]
  };
  // for now, if there's alt text, then there's an image. Later, the src will be filled in
  if (node[columns.alt] || (node[columns.image] && node[columns.image] !== "0")) {
    nodejson.i = {
      "s": node[columns.image],
      "a": node[columns.alt]
    }
  }
  if (node[columns.bigtext]) {
    nodejson.c = node[columns.bigtext];
  }
  if (node[columns.feedback]) {
    nodejson.l = node[columns.feedback];
  }
  return nodejson;
}

let allfiles = tsv2Arrays(tsvfilelist);

if (process.argv[2]) {
  //argv[2] is the filename
  allfiles = [[process.argv[2]]];
}
for (let i in allfiles) {
  let info = allfiles[i];
  let tsvfile;
  if (!info || info.length < 1 || !info[0]) {
    continue;
  }
  tsvfile = configdir + addIfNoExtension(info[0], 'tsv');
  let tsvobject = parseTSV(tsvfile, info.length < 2);
  let jsonobject = convertRowsToJSON(tsvobject);
  let outputFile = outputLocation + info[0] + ".json";
  fs.writeFileSync(outputFile, JSON.stringify(jsonobject));
}