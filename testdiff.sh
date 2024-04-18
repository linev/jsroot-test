# script dedicated to show difference between file in repository and current file on disk
# problem with direct diff that files has no line breaks and very difficult to analyze

git show master:$1 > file0.svg

echo "Formatting repository file..."
xmllint --format file0.svg > file1_.svg || echo "Failed to format file0.svg"

echo "Formatting disk file..."
xmllint --format $1 > file2_.svg || echo "Failed to format $1"

echo "Adjusting files based on noimg flag..."
if [[ "$2" == "noimg" ]]; then
   sed '/<image/d' file1_.svg > file1.svg
   sed '/<image/d' file2_.svg > file2.svg
else
   mv file1_.svg file1.svg
   mv file2_.svg file2.svg
fi

echo "Contents of file1.svg:"
cat file1.svg
echo "Contents of file2.svg:"
cat file2.svg

echo "Test diff is running"
colordiff file1.svg file2.svg || echo "Visible differences detected."

echo "Cleaning up..."
rm -f file0.svg file1.svg file2.svg file1_.svg file2_.svg
