# jsroot-test

JavaScript ROOT testing with Node.js v8

This is set of tests for basic JSROOT functionality, using Node.js.
On the first place one checks generation of SVG files.


## Installing

Clone JSROOT repository on the same level as this one:

    [shell] git clone https://github.com/root-project/jsroot.git
    [shell] git clone https://github.com/linev/jsroot-test.git

Select 'master' branch in JSROOT, which should correspond data in master branch of 'jsroot-test'

    [shell] cd jsroot
    [shell] npm install 
    
One could also use specific tag of JSROOT and appropriate tag in the tests    

After JSROOT repository is configured, one should install all necessary modules in test dir:

    [shell] cd jsroot-test
    [shell] npm install
    
## Running    

Run tests and verify test SVG files:

    [shell] node test.js [--verify]

Run tests only for TH1:

    [shell] node test.js --key TH1

Run tests and overwrite test SVG files:

    [shell] node test.js --create
    
Run more tests:

    [shell] node test.js --create --more
    
If SVG file differs from stored in repository, difference can be checked with command:

    [shell] ./testdiff.sh TH1/TH1.svg    

