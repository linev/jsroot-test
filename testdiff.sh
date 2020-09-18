# script dedicated to show difference between file in repository and current file on disk
# problem with direct diff that files has no line breaks and very difficult to analyze

git show v6:$1 > file0.svg

xmllint --format file0.svg > file1.svg

xmllint --format $1 > file2.svg

colordiff file1.svg file2.svg

rm -f file0.svg file1.svg file2.svg
