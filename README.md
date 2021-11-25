# jsroot-test

JavaScript ROOT testing with Node.js v12

This is set of tests for basic JSROOT functionality, using Node.js.
On the first place one checks generation of SVG files.


## Installing

Clone JSROOT repository on the same level as this one:

    [shell] git clone https://github.com/root-project/jsroot.git
    [shell] git clone https://github.com/linev/jsroot-test.git

After clone repository install all necessary modules:

    [shell] cd jsroot
    [shell] npm install
    [shell] cd jsroot-test
    [shell] npm install

One could also use specific tags of JSROOT and appropriate tag in the tests


## Running

Run tests and verify test SVG files:

    [shell] node test.js [--verify]

Run tests only for TH1:

    [shell] node test.js --key TH1

Run tests and overwrite test SVG files:

    [shell] node test.js --create

Run more tests:

    [shell] node test.js --create --more

Run with `xvfb` to get reproducible results on different platforms:

    [shell]  xvfb-run -s "-ac -screen 0 1280x1024x24"  node test.js -c -m

If SVG file differs from stored in repository, difference can be checked with command:

    [shell] ./testdiff.sh TH1/TH1.svg
