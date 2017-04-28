# jsroot-test
JavaScript ROOT testing with Node.js

This is set of tests for basic JSROOT functionality, using Node.js.
On the first place one checks generation of SVG files.


## How to use

Clone JSROOT repository on the same level as this one:

    [shell] git clone https://github.com/root-project/jsroot.git
    [shell] git clone https://github.com/linev/jsroot-test.git

Install all necessary modules:

    [shell] cd jsroot-test
    [shell] npm install

Run tests and verify test SVG files:

    [shell] node test.js [--verify]

Run tests and overwrite test SVG files:

    [shell] node test.js --create



