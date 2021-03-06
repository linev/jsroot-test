# script dedicated to show difference between file in repository and current file on disk
# problem with direct diff that files has no line breaks and very difficult to analyze

git show master:$1 > file0.svg

xmllint --format file0.svg > file1_.svg

xmllint --format $1 > file2_.svg

if [[ "$2" == "noimg" ]]; then
   sed '/<image/d' file1_.svg > file1.svg
   sed '/<image/d' file2_.svg > file2.svg
else
   mv file1_.svg file1.svg
   mv file2_.svg file2.svg
fi

colordiff file1.svg file2.svg

rm -f file0.svg file1.svg file2.svg file1_.svg file2_.svg
