# jsroot-test

JavaScript ROOT testing with Node.js

This is set of tests for basic JSROOT functionality, using Node.js.
On the first place one checks generation of SVG files.


## How to use

Clone JSROOT repository on the same level as this one:

    [shell] git clone https://github.com/root-project/jsroot.git
    [shell] git clone https://github.com/linev/jsroot-test.git

Tests can be performed staring from JSROOT 5.2.0 or with 'dev' branch:

    [shell] cd jsroot
    [shell] git fetch 
    [shell] git checkout dev 

Install all necessary modules:

    [shell] cd jsroot-test
    [shell] npm install

Run tests and verify test SVG files:

    [shell] node test.js [--verify]

Run tests only for TH1:

    [shell] node test.js --key TH1

Run tests and overwrite test SVG files:

    [shell] node test.js --create



