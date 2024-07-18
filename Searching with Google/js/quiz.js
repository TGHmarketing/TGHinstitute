let state = JSON.parse(localStorage.getItem('quizstatus'));
if (!state) {
  state = [];
  localStorage.setItem('quizstatus', JSON.stringify(state));
}

let TGHQuiz = (function () {
  return {
    qnum: 0, // question number
    qid: null, // question ID
    nodenum: 0, // current "pane" of the question
    node: null, // data for current "pane"
    unit: "example1", // id of the unit
    quizdata: null, // full quiz data for all units - maybe keep them separate actually
    quiz: null, // quiz data for selected unit: an order and a set of keyed questions
    qlist: null, // list of the question IDs in order
    qtitle: null,
    result: null, // the "Right" or "Oops" text
    q: null, // data for the current question
    content: null,
    qdiv: null,
    qimg: null,
    answerButtons: null, // todo: maybe drop
    buttonNext: null,
    buttonRestart: null,
    buttonComplete: null,
    qnav: null,
    questionButtons: null,
    correct: 0,
    correctButton: null,
    score: 0,
    userAnswers: null,
    shuffledAnswers: null, // saving the shuffled order - TODO remove?
    lastAnswered: -1,
    breadcrumbs: null,
    unitid: null,
    module: 0,
    name: null,
    homebutton: null,

    setTitle(text) {
      this.unitTitle.innerHTML = text;
    },

    loadQuiz(allquizdata, quizid) { // TODO: maybe keep the quiz data separate instead of this combined one
      window.addEventListener("popstate", (event) => {
        if (event.state) {
          if (event.state.q === 'r') {
            // special review thing
            this.doReview();
          } else {
            this.showQuestionAndNode(event.state.q, event.state.n);
          }
        } else {
          this.firstLoad();
        }
      });
      this.loadQuizData(allquizdata, function () {
        if (TGHQuiz.setQuiz(quizid)) {
          TGHQuiz.firstLoad();
        } else {
          console.warn("couldn't load quiz data");
        }
      });
    },

    loadQuizData(url, callback) {
      fetch(url).then(function (response) {
        response.json().then(function (result) {
          this.parseQuiz(result);
          if (callback) {
            callback();
          }
        }.bind(this));
      }.bind(this), function (response) {
        console.warn("rejected ", response);
      });
    },

    firstLoad() {
      let questionnum = getQS('q');
      let node = getQS('n');
      let page = getQS('p');
      let skip = false;
      if (questionnum) {
        questionnum--;
        skip = true;
      }
      if (node) {
        node--;
      }
      if (page) {
        let nodebits = this.getNodeFromPagenum(page);
        if (nodebits) {
          questionnum = nodebits[0];
          node = nodebits[1];
          skip = true;
        }
      }
      let checkimages = false;
      if (checkimages) {
        for (let i in this.qlist) {
          let section = this.qlist[i];
          let quizpack = this.quiz[this.qlist[i]];
          for (let j in quizpack) {
            let quiznode = quizpack[j];
            if (quiznode.i) {
              let newimg = document.createElement('img');
              newimg.src = 'img/' + quiznode.i.s;
              setTimeout(() => {
                if (newimg.height === 0) {
                  console.log("**MISSING IMAGE: '" + quiznode.i.s + "' | section " + section + " question " + (1 + parseInt(j) + " - " + quiznode.t));
                }
              }, 1000);
            } else if (!quiznode.c) {
              console.warn("no image filename and no callout?");
            }
          }
        }
      }
      if (state.includes(this.unitid) && !skip) {
        this.doReview();
      } else {
        this.startOver(questionnum, node);
      }
    },

    setButtons(buttonElementArray) {
      this.answerButtons = [];
      this.playerAnswer = this.playerAnswer.bind(this);
      for (let i in buttonElementArray) {
        let thisbutton = buttonElementArray[i];
        this.answerButtons.push(thisbutton);
        thisbutton.addEventListener('click', this.playerAnswer);
        thisbutton.text = document.createElement('div');
        thisbutton.text.classList.add('answertext');
        thisbutton.appendChild(thisbutton.text);
      }
    },

    parseQuiz(quizdata) {
      this.quizdata = quizdata;
    },

    setQuiz(unit) {
      if (this.quizdata[unit]) {
        this.unit = unit;
        this.quiz = this.quizdata[this.unit];
        this.qlist = this.quiz._order.slice(0, this.quiz._order.length - 1);// remove the final section, which is review
        this.totalpages = this.quiz._pages;
        return true;
      }
      this.quiz = this.quizdata;
      this.totalpages = this.quiz._pages;
      this.qlist = this.quiz._order.slice(0, this.quiz._order.length - 1);
      return true;
    },

    saveToHistory() {
      let state = { q: this.qnum, n: this.nodenum };
      let url = new URL(location);
      url.searchParams.set("q", this.qnum + 1);
      url.searchParams.set("n", this.nodenum + 1);
      url.searchParams.set("p", this.pagenum);
      if (this.reviewing) {
        state = { q: 'r' };
      }
      history.pushState(state, "", url);
    },

    showNextNode() {
      // node will have at least text.
      // it may also have an image, or a callout
      // it may feature answer buttons
      let next = 1;
      if (this.node.type === 'r') {
        if (this.q[this.nodenum + 1] && this.q[this.nodenum + 1].type === "r") {
          next += 1;
        }
      }
      if (this.q[this.nodenum + next]) {
        this.showNode(this.nodenum + next);
      } else {
        this.showNextQuestion();
      }
      setTimeout(() => { this.saveToHistory() }, 10);
    },

    showQuestionAndNode(qnum, nodenum) {
      this.qnum = qnum;
      let qid = this.qlist[qnum];
      this.startQuestion(qid, nodenum, true);
    },

    showNode(nodenum, notransition) {
      this.homebutton.setAttribute('tabindex', "-1");
      this.nodenum = nodenum;
      this.breadcrumbs.innerHTML = "qr: " + (this.qnum + 1) + "." + (this.nodenum + 1);
      if (this.q[this.nodenum]) {
        this.node = this.q[this.nodenum];
        this.paginate();
        if (notransition) {
          this.populateWithContent(true);
          this.revealQuestion(true).then(() => {
            this.revealNav(true);
            this.showAnswersNow();
          });
        } else {
          this.hideCurrent().then(() => {
            this.qdiv.style.visibility = "hidden";
            this.qimg.style.visibility = "hidden";
            for (let i in this.answerButtons) {
              this.answerButtons[i].style.visibility = "hidden";
            }
            this.populateWithContent().then(() => {
              this.revealQuestion(this.lastquestion).then(() => {
                if (this.node.type === 'q') {
                  this.revealAnswers().then(() => {
                    this.showBackButton();
                    this.animDone();
                  });
                } else {
                  this.revealNav();
                }
              });
            })
          })
        }
        //this.qdiv.focus();
        return true;
      } else {
        return false;
      }
    },

    showAnswerNode(nodenum) {
      if (this.q[nodenum]) {
        this.nodenum = nodenum;
        this.breadcrumbs.innerHTML = "q: " + (this.qnum + 1) + "." + (this.nodenum + 1);
        this.node = this.q[this.nodenum];
        this.paginate();
        this.revealResult();
        this.saveToHistory();
      }
    },

    imageReady(ev) {
      this.qimg.style = null;
    },

    populateWithContent(notransition) {
      // generally just show the parts of the node, with a next button
      // special case for "question" nodes
      return new Promise((resolve, reject) => {
        let text = markString(this.node.t);
        if (this.node.c) {
          text += "<div class=\"callout\">" + markString(this.node.c) + "</div>";
        }
        this.setText(text);
        if (this.node.i) {
          this.showImage();
          this.qimg.src = "img/" + this.node.i.s;
          let alt = this.node.i.a === 'null' ? "" : this.node.i.a;
          this.qimg.setAttribute('alt', alt);
          this.qimg.onload = function (ev) {
            this.imageReady(ev);
            resolve();
          }.bind(this);
        } else {
          this.showImage(false);
        }
        if (this.node.type === "q") {
          this.showResult(false);
          this.setAnswerButtons();
        } else if (this.node.type === "r") {
          // nothing special?
          this.showResult(this.node.l, notransition);
          this.showAnswerBox(false);
        } else {
          this.showResult(false);
          this.showAnswerBox(false);
        }
        // special case for the very last node; it's the end of the review
        if (this.lastquestion || this.reviewing) {
          this.showResult(this.name, true);
          this.setTitle("Module " + this.module);
        } else {
          this.setTitle("Module " + this.module + " - " + this.name);
        }
        if (!this.node.i) {
          resolve();
        }
      });
    },

    getNodeFromPagenum(pagenum) {
      pagenum = parseInt(pagenum);
      for (let n in this.qlist) {
        let snum = this.qlist[n];
        let section = this.quiz[snum];
        for (let i in section) {
          let node = section[i];
          if (node.page === pagenum) {
            return [parseInt(snum) - 1, parseInt(i)];
          }
        }
      }
      return false;
    },

    paginate() {
      this.pagenum = this.node.page;
      this.breadcrumbs.innerHTML = " Page " + this.pagenum + " of " + this.totalpages;
    },

    hideCurrent(slide) {
      return new Promise((resolve, reject) => {
        if (this.qnum >= this.qlist.length - 1 && this.nodenum > 0) { // no transitions on the last one
          resolve();
          return;
        }
        this.body.classList.add("moving");
        // first transition out
        if (slide) {
          this.setTransitionType(this.qimg, 'slide');
          this.setTransitionType(this.qdiv, 'slide');
        } else {
          this.setTransitionType(this.qimg, 'fade');
          this.setTransitionType(this.qdiv, 'fade');
        }
        // fade out unless previous node was r
        setTimeout(() => {
          this.qdiv.classList.add('exit');
          this.qimg.classList.add('exit');
          this.qdiv.classList.remove('enter');
          this.qimg.classList.remove('enter');
          for (let i in this.answerButtons) {
            this.answerButtons[i].classList.add('exit');
            this.answerButtons[i].classList.remove('enter');
          }
        }, 10);

        this.qdiv.removeEventListener("transitionend", this.afterQ);
        this.afterQ = function (event) {
          //this.showResult(false);
          this.qdiv.ontransitionend = null;
          resolve();
          //this.qdiv.classList.remove('exit');
        }.bind(this);
        this.qdiv.ontransitionend = this.afterQ;
      });
    },

    revealResult(notransition) {
      this.body.classList.add("moving");
      this.qimg.classList.remove('enter');
      this.qdiv.classList.remove('enter');
      this.populateWithContent();
      this.showAnswerBox(false);
      setTimeout(() => {
        this.setTransitionType(this.qdiv, 'slide');
        this.setTransitionType(this.qimg, 'slide');
        this.revealQuestion().then(() => {
          this.revealNav();
        });
      }, 1000);
    },

    revealQuestion(notransition) {
      this.body.classList.add("moving");
      return new Promise((resolve, reject) => {
        if (notransition) {
          this.qdiv.classList.remove('exit');
          this.qdiv.classList.add('enter');
          this.qimg.style.visibility = "visible";
          this.qdiv.style.visibility = "visible";
          this.revealQimg();
          resolve();
        } else {
          // put into position
          // if it's a contination of fade, leave it
          this.transitionSet();
          let time = 500;
          setTimeout(() => {
            if (this.node.type === "q") {
              // slide in: set things off screen first
              this.setTransitionType(this.qdiv, 'slide');
              this.setTransitionType(this.qimg, 'slide');
              time = 1000;
            } else if (this.node.type === "r") {
              this.setTransitionType(this.qdiv, 'slide2');
              this.setTransitionType(this.qimg, 'slide2');
              time = 1000;
            } else {
              this.setTransitionType(this.qdiv, 'fade');
              this.setTransitionType(this.qimg, 'fade');
            }
            setTimeout(() => {
              this.qdiv.style.visibility = "visible";
              this.qdiv.classList.remove('ready');
              this.qdiv.classList.remove("exit");
              this.qdiv.classList.add("enter");
              setTimeout(() => {
                this.qimg.classList.remove('ready');
                this.qimg.style.visibility = "visible";
                this.revealQimg();
                setTimeout(() => {
                  resolve();
                }, time);
              }, 100);
            }, 20);
          }, 20);
        }
      });
    },

    setTransitionType(element, type) {
      element.classList.remove('slide', 'slide2', 'fade');
      element.classList.add(type);
    },

    transitionSet() {
      this.qdiv.classList.add('ready');
      this.qimg.classList.add('ready');
      for (let i in this.answerButtons) {
        this.answerButtons[i].classList.add('ready');
      }
      setTimeout(() => {
        this.qdiv.classList.remove("enter");
        this.qdiv.classList.add('exit');
        this.qimg.classList.remove("enter");
        this.qimg.classList.add('exit');
        for (let i in this.answerButtons) {
          this.answerButtons[i].classList.remove('enter');
          this.answerButtons[i].classList.add('exit');
        }
      }, 10);
    },

    revealQimg() {
      this.qimg.classList.remove('exit');
      this.qimg.classList.add('enter');
    },

    revealNav(notransition) {
      this.showBackButton();
      this.showComplete(false);
      // special case for the very last node; it's the end of the review
      if (this.reviewing || (this.lastquestion && this.nodenum >= this.q.length - 1)) {
        this.showNextButton(false);
        if (this.reviewing) {
          this.showRestart(true);
          this.showComplete(false);
        } else {
          this.showComplete(true);
          this.showRestart(false);
        }
      } else if (this.node.type === "q") {
        this.showNextButton(false);
        /// show the questions now here?
      } else {
        this.showNextButton();
      }
      this.animDone();
    },

    revealAnswers(notransition) {
      for (let i in this.answerButtons) {
        this.answerButtons[i].setAttribute('tabindex', '-1');
        this.answerButtons[i].classList.remove('ready');
        this.answerButtons[i].style.visibility = "visible";
      }
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          this.answerButtons[0].classList.remove('exit');
          this.answerButtons[0].classList.add('enter');
          setTimeout(() => {
            this.answerButtons[1].classList.remove('exit');
            this.answerButtons[1].classList.add('enter');
            setTimeout(() => {
              resolve();
            }, 1000);
          }, 200);
        }, 10);
      });
    },

    showAnswersNow() {
      for (let i in this.answerButtons) {
        this.answerButtons[i].setAttribute('tabindex', '0');
        this.answerButtons[i].classList.remove('exit', 'enter');
        this.answerButtons[i].style.visibility = "visible";
      }
    },

    showNextQuestion() {
      this.qnum++;
      if (this.qnum >= this.qlist.length) {
        window.location = "../index.html";
        return false;
      }
      let qid = this.qlist[this.qnum];
      this.startQuestion(qid);
      return true;
    },

    startQuestion(qid, nodenum, fromhistory) {
      this.qid = qid;
      this.q = this.quiz[this.qid];
      if (!nodenum) {
        nodenum = 0;
      }
      this.lastquestion = this.qnum >= this.qlist.length - 1;
      this.showNode(nodenum, fromhistory);
    },

    setAnswerButtons() {
      let shuffled = [0, 1, 2, 3];
      this.correct = this.node.r;
      for (let i = 0; i < this.answerButtons.length; i++) {
        if (i >= this.node.a.length) {
          this.showAnswerButton(this.answerButtons[i], false);
          continue;
        }
        this.answerButtons[i].text.innerHTML = markString(this.node.a[shuffled[i]]);
        this.answerButtons[i].setAttribute('data-anum', shuffled[i]);
        if (shuffled[i] === this.correct) {
          this.correctButton = this.answerButtons[i];
        }
        this.answerButtons[i].classList.remove('correct', 'incorrect', 'answered', 'enter', 'exit', 'fade');
        this.answerButtons[i].removeAttribute('disabled');
        this.showAnswerButton(this.answerButtons[i], true);
        this.answerButtons[i].classList.add('slide2');
      }
      this.showAnswerBox();
    },

    playerAnswer(ev) {
      for (let i in this.answerButtons) {
        this.answerButtons[i].setAttribute('disabled', 'disabled');
      }
      this.judgeAnswer(ev.currentTarget);
    },

    judgeAnswer(button) {
      this.showBackButton(false);
      let num = parseInt(button.getAttribute('data-anum'));
      for (let i in this.answerButtons) {
        this.setTransitionType(this.answerButtons[i], 'fade');
        if (this.answerButtons[i] !== button) {
          this.answerButtons[i].classList.add('exit');
        }
      } if (num === this.correct || this.correct < 0) {
        // add to the score?
        this.score++;
        this.answerButtons[num].classList.add('correct');
      } else {
        this.answerButtons[num].classList.add('incorrect');
      }
      setTimeout(() => {
        this.hideCurrent(false).then(() => {
          this.showAnswerNode(this.nodenum + 1 + num);
        });
        this.userAnswers[this.qnum] = num;
      }, 1500);
    },

    showResult(text, instant) {
      if (text) {
        this.result.innerHTML = text;
        this.result.style.display = null;
        if (instant) {
          this.result.classList.remove('small');
        } else {
          this.result.classList.add('small');
          setTimeout(() => {
            this.result.classList.remove('small');
          }, 50);
          return;
        }
      } else {
        this.result.style.display = "none";
      }
    },

    setText(text) {
      this.qdiv.innerHTML = text;
    },

    showText(noshow) {
      if (noshow === false) {
        //this.qdiv.style.visibility = "hidden";
      } else {
        //this.qdiv.style.visibility = "visible";
        //this.qdiv.focus();
      }
    },

    showImage(noshow) {
      if (noshow === false) {
        this.qimg.style.display = "none";
      } else {
        this.qimg.style.display = null;
      }
    },

    animDone() {
      this.body.classList.remove("moving");
      this.homebutton.setAttribute('tabindex', "0");
      this.qfull.focus();
      for (let i in this.answerButtons) {
        this.answerButtons[i].setAttribute('tabindex', '0');
      }
    },

    showAnswerButton(button, noshow) {
      button.style.display = noshow === false ? "none" : null;
    },

    showAnswerBox(noshow) {
      document.getElementById('buttonbox').style.display = noshow === false ? "none" : null;
    },

    showNextButton(noshow) {
      this.buttonNext.style.display = noshow === false ? "none" : null;
      if (noshow !== false) {
        this.buttonNext.disabled = null;
      }
    },

    showBackButton(noshow) {
      this.buttonBack.style.display = noshow === false ? "none" : null;
    },

    setNextText(text) {
      this.buttonNext.innerHTML = text.replace(/ /g, "&nbsp;") + ' <img alt="arrow" class="icon" src="../img/icon-next.svg"/>';
    },

    showComplete(noshow) {
      this.buttonComplete.style.display = noshow === false ? "none" : null;
    },

    showRestart(noshow) {
      this.buttonRestart.style.display = noshow === false ? "none" : null;
    },

    clickNext() {
      // either go to the next question or back to the index
      this.buttonNext.setAttribute('disabled', 'disabled');
      this.homebutton.setAttribute('tabindex', "-1");
      this.showNextButton(false);
      this.showBackButton(false);
      this.showNextNode();
    },


    clickBack() {
      // either go to the next question or back to the index
      history.back();
    },

    clickHome() {
      window.location = "../index.html";
    },

    clickRestart() {
      state.splice(state.indexOf(this.unitid), 1);
      this.reviewing = false;
      localStorage.setItem('quizstatus', JSON.stringify(state));
      this.startOver();
      this.saveToHistory();
    },

    clickComplete() {
      if (!state.includes(this.unitid)) {
        state.push(this.unitid);
      }
      localStorage.setItem('quizstatus', JSON.stringify(state));
      window.location = "../index.html";
    },

    startOver(firstquestion, node) {
      TGHQuiz.setTitle("Module " + this.module + " - " + this.name);
      for (let i in this.questionButtons) {
        let button = this.questionButtons[i];
        button.classList.remove("wrong", "right", "answered", "current", "notyet");
      }
      this.lastAnswered = -1;
      this.clearAnswers();
      let q = firstquestion | 0;
      this.showComplete(false);
      this.showRestart(false);
      this.setNextText("Next");
      this.startOnQuestion(q, node);
    },

    startOnQuestion(questionnum, nodenum, fromhistory) {
      this.qnum = questionnum;
      let qid = this.qlist[this.qnum];
      this.startQuestion(qid, nodenum, fromhistory);
    },

    clearAnswers() {
      this.userAnswers = [];
      this.shuffledAnswers = [];
      for (let i = 0; i < this.quiz.length; i++) {
        this.userAnswers.push(-1);
        this.shuffledAnswers[i] = null;
      }
    },

    doReview() {
      this.reviewing = true;
      this.node = this.quiz._review;
      this.populateWithContent(true).then(() => {
        this.revealQuestion(true).then(() => {
          this.revealNav(true);
        });
      });
    },

    getBoxHeight(element) {
      element.style.height = element.scrollHeight + "px";
    }
  }
})();

TGHQuiz.content = document.getElementById('content');
TGHQuiz.qnav = document.getElementById('qnav');
TGHQuiz.qtitle = document.getElementById('questionnumber');
TGHQuiz.qfull = document.getElementById('questionfull');
TGHQuiz.qdiv = document.getElementById('questiontext');
TGHQuiz.result = document.getElementById('result');
TGHQuiz.setButtons([document.getElementById('buttonA'), document.getElementById('buttonB')]);
TGHQuiz.homebutton = document.getElementById('homebutton');
buttonIt('buttonNext', TGHQuiz.clickNext);
buttonIt('buttonBack', TGHQuiz.clickBack);
buttonIt('buttonRestart', TGHQuiz.clickRestart);
buttonIt('buttonComplete', TGHQuiz.clickComplete);
TGHQuiz.unitTitle = document.getElementById('unit-title');
TGHQuiz.qimg = document.getElementById('quizimage');
TGHQuiz.qimg.onerror = function (ev) {
  ev.currentTarget.style.height = "18em";
};
TGHQuiz.breadcrumbs = document.getElementById('breadcrumbs'); // TODO: for testing for now, but may need to include & expand
TGHQuiz.body = document.body;

document.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    TGHQuiz.qfull.classList.remove('notab');
  }
});

/** quick little markdown-y regex */
function markString(str) {
  let html = str;
  if (html.match(/[\r\n]+\d+\.\s+/) || html.match(/^\d+\.\s+/)) { // turn number lists into <ol>
    let start;
    if (html.match(/^\d+\.\s+/)) {
      start = html.replace(/^(\d+)\.\s+[\s\S]*/, "$1");
    } else {
      start = html.replace(/[\s\S]+?[\r\n]+?(\d+)\.\s+[\s\S]*/, "$1");
    }
    html = html.replace(/^\s*\d+\.\s+(\S.+)/g, "<li>$1</li>");
    html = html.replace(/[\r\n]+\s*\d+\.\s+(\S.+)/g, "<li>$1</li>");
    let rep = "<ol>$1</ol>";
    if (start !== "1") {
      rep = "<ol start=" + start + ">$1</ol>";
    }
    html = html.replace(/(<li>.*<\/li>)[\r\n]*/g, rep);
  }
  if (html.match(/[\r\n]+\s*[-^*\u2013]\s+/) || html.match(/^\s*[-^*\u2013]\s+/)) { // turn hyphen-beginners into <ul> sometimes the hyphens come in as en dashes (u2013)
    html = html.replace(/^\s*[-^*\u2013]\s*(\S.+)/g, "<li>$1</li>");
    html = html.replace(/[\r\n]+\s*[-^*\u2013]\s*(\S.+)/g, "<li>$1</li>");
    html = html.replace(/(<li>.+<\/li>)[\r\n]*/g, "<ul>$1</ul>");
  }
  html = html.replace(/\*(\w[^\*]*)\W/g, "<strong>$1</strong>");
  html = html.replace(/\~(\w[^\~]*)\W/g, "<em>$1</em>");
  html = html.replace(/[\n]/g, "<br/>");
  html = html.replace(/ \u2013 /g, " &ndash; ");
  html = html.replace(/ \u2014 /g, " &mdash; ");
  return html;
}

// TODO: maybe aren't placing images inline anywhere?
function placeImage(str, image) {
  if (str.match(/<img>/)) {
    str = str.replace(/<img>/, '<img src="img/' + image.src + '" alt="' + image.alt + '" class="inlineimage">');
    return str;
  }
  return null;
}

function getQS(key) {
  var qst = window.location.search.substring(1).split('&');
  var re = new RegExp(key);
  for (var z in qst) {
    if (re.test(qst[z])) {
      var sp = qst[z].split('=');
      if (sp[0] === key) {
        return decodeURI(sp[1]);
      }
    }
  }
  return false;
}

function buttonIt(buttonName, action) {
  let button = document.getElementById(buttonName);
  if (!button) {
    console.error("no button with ID " + buttonname);
    return;
  }
  TGHQuiz[buttonName] = button;
  action = action.bind(TGHQuiz);
  button.addEventListener('touchstart', () => { });
  button.addEventListener('click', action);
}

/*
function resized() {
  let buttons = document.getElementById('button_block');
  let buttonheight = 90;
  buttons.style.height = (parseInt(window.getComputedStyle(document.body).height) + buttonheight) + "px";
}*/
//window.addEventListener('resize', resized);
//resized();