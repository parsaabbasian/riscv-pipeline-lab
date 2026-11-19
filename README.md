# RISC-V Pipeline Lab

Interactive learning platform for Lecture 8, *Pipeline Concept* (Computer Organization and Design, RISC-V Edition, Ch. 4).

- 10 modules / 33 topics covering slides 1–61, each in a 12-step format with Beginner / Standard / Exam modes
- 5-stage pipeline simulator (forwarding, load-use stalls, structural hazards, branch stall / predict-not-taken, wrong-register bug from slide 61)
- Single-cycle datapath explorer with live control signals, multicycle comparison, branch-prediction lab, performance calculator
- 70+ quiz questions plus simulator-generated problems, glossary, slide coverage matrix
- Progress saved in localStorage

```
npm install
npm run dev     # start
npm test        # simulation unit tests
npm run build   # production build in dist/
```
