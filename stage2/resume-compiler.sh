#!/bin/sh -eu

assert_dir_nonempty() {
    if [ -z "$(ls -A "$1")" ]; then
        printf "Directory %s is unexpectedly empty. Quitting.\n" "$1" >&2
        exit 1
    fi
}

assert_file_exists() {
    if [ ! -f "$1" ]; then
        printf "File %s doesn't exist. Quitting.\n" "$1" >&2
        exit 1
    fi
}

# Originally based on https://superuser.com/a/1307895/738724.
remove_blank_pages() {
    pdf="$1"

    # Execute the PDF using Ghostscript, outputting to the ink coverage device.
    # For each page, the ink coverage device prints the
    # ratio of coverage for C, M, Y, and K.
    ink_coverage=$(gs -q -o - -sDEVICE=inkcov "$pdf")

    num_pages=$(printf '%s\n' "$ink_coverage" | wc -l)

    # If any of the four channels have a nonzero average, consider this page nonblank.
    non_blank_pages=$(printf '%s\n' "$ink_coverage" |
        awk '$1 + $2 + $3 + $4 > 0 {printf("%d ", NR) }')
    num_non_blank_pages=$(echo "$non_blank_pages" | wc -w)

    if [ "$num_pages" -ne "$num_non_blank_pages" ]; then
        set -f
        # shellcheck disable=SC2086
        pdftk "$pdf" cat $non_blank_pages output temp.pdf verbose
        set +f
        mv temp.pdf "$pdf"
    fi
}

readonly DIR_IN="./in"
assert_dir_nonempty "$DIR_IN"

readonly ARC_ORIG="$DIR_IN/original_resumes.zip"
assert_file_exists "$ARC_ORIG"
readonly ARC_CONV="$DIR_IN/converted_resumes.zip"
assert_file_exists "$ARC_CONV"
readonly COVER_PAGE="$DIR_IN/cover_page.pdf"
assert_file_exists "$COVER_PAGE"

readonly DIR_WORK="./work"
readonly DIR_ORIG="$DIR_WORK/orig"
readonly DIR_CONV="$DIR_WORK/conv"
readonly DIR_COMP="$DIR_WORK/comp"

# Work-in-progress book PDF.
readonly PDF_WORK="$DIR_WORK/work.pdf"
# Temporary file that immediately gets copied to the work file.
readonly PDF_TEMP="$DIR_WORK/temp.pdf"
# Final book PDF.
readonly PDF_BOOK="./book.pdf"

# The working area for the PDF metadata.
readonly INFO_FULL="$DIR_WORK/data_full.info"
# The file we will have our new bookmarks in.
readonly INFO_BOOKMARKS="$DIR_WORK/data_bookmarks.info"

# BookmarkBegin
# BookmarkTitle: Education &amp; Extracurricular activities
# BookmarkLevel: 1
# BookmarkPageNumber: 100

rm -rf "$DIR_WORK"
mkdir "$DIR_WORK"

printf "Unpacking archives...\n"

mkdir "$DIR_ORIG"
unzip "$ARC_ORIG" -d "$DIR_ORIG"
assert_dir_nonempty "$DIR_ORIG"

mkdir "$DIR_CONV"
unzip "$ARC_CONV" -d "$DIR_CONV"
assert_dir_nonempty "$DIR_CONV"

printf "Fixing corrupt PDF...\n"

if [ -f ./patches.sh ]; then
    cd "$DIR_ORIG"
    # shellcheck source=stage2/patches.sh
    . ../../patches.sh
    cd -
fi

printf "Removing blank pages...\n"

for f in "$DIR_ORIG"/*.pdf "$DIR_CONV"/*; do
    remove_blank_pages "$f"
done

printf "Linking PDFs...\n"

mkdir "$DIR_COMP"
ln -s "$(pwd)"/"$DIR_ORIG"/*.pdf "$(pwd)"/"$DIR_CONV"/* "$DIR_COMP"
assert_dir_nonempty "$DIR_CONV"

printf "Stripping blank pages...\n"

printf "Compiling resume book...\n"

output_info=$(pdftk "$DIR_COMP"/*.pdf cat output "$PDF_WORK" verbose | tee /dev/tty)

printf "Ripping PDF info...\n"

pdftk "$PDF_WORK" dump_data output "$INFO_FULL" verbose

printf "Generating new bookmarks...\n"

printf "%s\n" "$output_info" | awk '\
    BEGIN { page = 0 }
    match($0, /^[[:space:]]+Adding page /) {
        ++page
        # Only add a bookmark for the first page of the resume.
        if (substr($0, RSTART + RLENGTH, 2) == "1 ") {
            # Extract the name from the line.
            match($0, /from \.\//)
            name_begin = RSTART + RLENGTH
            match($0, / Resume.pdf$/)
            name_end = RSTART
            name_len = name_end - name_begin

            print "BookmarkBegin"
            printf("BookmarkTitle: %s\n", substr($0, name_begin, name_len))
            print "BookmarkLevel: 1"
            printf("BookmarkPageNumber: %d\n", page)
        }
    }' >$INFO_BOOKMARKS

printf "Replacing PDF bookmarks...\n"

# Thanks: https://superuser.com/a/440057/738724
readonly BEGIN_MARKER="^NumberOfPages"
readonly END_MARKER="^PageMediaBegin"
sed -i "/$BEGIN_MARKER/,/$END_MARKER/ { /$BEGIN_MARKER/ { p; r $INFO_BOOKMARKS
}; /$END_MARKER/p; d }" "$INFO_FULL"

pdftk "$PDF_WORK" update_info "$INFO_FULL" output "$PDF_TEMP" verbose
mv "$PDF_TEMP" "$PDF_WORK"

printf "Prepending cover...\n"
pdftk "$COVER_PAGE" "$PDF_WORK" cat output temp.pdf verbose
mv temp.pdf "$PDF_WORK"

mv "$PDF_WORK" "$PDF_BOOK"
