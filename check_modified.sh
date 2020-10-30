#!/bin/bash

files=`git ls-files -m */*.svg `

for filename in $files; do
   echo $filename
   ./testdiff.sh $filename noimg
done
