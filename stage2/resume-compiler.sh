#!/bin/sh -eu

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

assert_dir_nonempty() {
    if [ -z "$(ls -A "$1")" ]; then
        printf "Directory %s is unexpectedly empty. Quitting.\n" "$1" >&2
    fi
}

readonly DIR_OUT="./out"
readonly DIR_ORIG="$DIR_OUT/orig"
readonly DIR_CONV="$DIR_OUT/conv"
readonly DIR_COMP="$DIR_OUT/comp"

readonly ARC_ORIG="original_resumes.zip"
readonly ARC_CONV="converted_resumes.zip"

readonly BOOK="../resume_book.pdf"
readonly COVER_PAGE="/home/koopa/Pictures/Account Assets/HackBU/rb_cover.pdf"

# BookmarkBegin
# BookmarkTitle: Education &amp; Extracurricular activities
# BookmarkLevel: 1
# BookmarkPageNumber: 100

rm -rf "$DIR_OUT"
mkdir "$DIR_OUT"

printf "Unpacking archives...\n"

mkdir "$DIR_ORIG"
unzip "$ARC_ORIG" -d "$DIR_ORIG"
assert_dir_nonempty "$DIR_ORIG"

mkdir "$DIR_CONV"
unzip "$ARC_CONV" -d "$DIR_CONV"
assert_dir_nonempty "$DIR_CONV"

printf "Fixing corrupt PDF...\n"

printf "Removing blank pages...\n"

for f in "$DIR_ORIG"/*.pdf "$DIR_CONV"/*; do
    remove_blank_pages "$f"
done

printf "Linking PDFs...\n"

mkdir "$DIR_COMP"
ln -s "$(pwd)"/"$DIR_ORIG"/*.pdf "$(pwd)"/"$DIR_CONV"/* "$DIR_COMP"
assert_dir_nonempty "$DIR_CONV"

cd "$DIR_COMP"

printf "Stripping blank pages...\n"

printf "Compiling resume book...\n"

output_info=$(pdftk ./*.pdf cat output "$BOOK" verbose | tee /dev/tty)

printf "Ripping PDF info...\n"

pdftk "$BOOK" dump_data output data_full.info verbose

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
    }' >data_bookmarks.info

printf "Replacing PDF bookmarks...\n"

# Thanks: https://superuser.com/a/440057/738724
readonly BEGIN_MARKER="^NumberOfPages"
readonly END_MARKER="^PageMediaBegin"
sed -i "/$BEGIN_MARKER/,/$END_MARKER/ { /$BEGIN_MARKER/ { p; r data_bookmarks.info
}; /$END_MARKER/p; d }" data_full.info

pdftk "$BOOK" update_info data_full.info output temp.pdf verbose
mv temp.pdf "$BOOK"

printf "Prepending cover...\n"
pdftk "$COVER_PAGE" "$BOOK" cat output temp.pdf verbose
mv temp.pdf "$BOOK"

cd -
