/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Ubiquity.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Atul Varma <atul@mozilla.com>
 *   Sander Dijkhuis <sander.dijkhuis@gmail.com>
 *   Alberto Santini <albertosantini@gmail.com>
 *   Simone Deponti <simone.deponti@abstract.it>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

(function($) {
    // = App =
    //
    // This is the application that processes the code and lets the user
    // navigate through and read the documentation.
    //
    // It lives in {{{window.code_illuminated}}} where it can be fetched
    // to apply customizations.

    if((typeof window.code_illuminated) === "undefined")
        window.code_illuminated = {};

    var App = window.code_illuminated;

    // == App.trim() ==
    //
    // Returns {{{str}}} without whitespace at the beginning and the end.

    App.trim = function trim(str) {
        return str.replace(/^\s+|\s+$/g,"");
    };

    // == App.processors ==
    //
    // An array of user-defined processor functions.  They should take one
    // argument, the DOM node containing the documentation.  User-defined
    // processor functions are called after standard processing is done.

    App.processors = [];

    App.menuItems = {};   // Has a {label, urlOrCallback} dict for each keyword.

    // == App.CREOLE ==
    //
    // The configurations bit of the creole markup,
    // mostly used to add [[http://www.wikicreole.org/wiki/Creole1.0#section-Creole1.0-LinksInternalExternalAndInterwiki|interwiki]] links.
    //
    // As of now, the linked interwikis are:
    //  * {{{WikiCreole}}}, http://www.wikicreole.org/wiki/
    //  * {{{Wikipedia}}}, http://en.wikipedia.org/wiki/
    //  * {{{MDNJavascript}}}, https://developer.mozilla.org/en/JavaScript/Reference/
    //  * {{{MDNCSS}}}, https://developer.mozilla.org/en-US/docs/CSS/
    //  * {{{MDN}}}, https://developer.mozilla.org/en/
    //
    // Further interwikis can be added by adding the following javascript
    // at the very bottom of the documentation index page (HTML):
    // {{{
    // <script type="text/javascript">
    //    window.code_illuminated.CREOLE.interwiki['Foo'] = 'http://example.com/';
    // </script>
    // }}}

    App.CREOLE = {
        forIE: document.all,
        interwiki: {
            WikiCreole: 'http://www.wikicreole.org/wiki/',
            Wikipedia: 'http://en.wikipedia.org/wiki/',
            MDNCSS: 'https://developer.mozilla.org/en-US/docs/CSS/',
            MDNJavascript: 'https://developer.mozilla.org/en/JavaScript/Reference/',
            MDN: 'https://developer.mozilla.org/en/'
        },
        linkFormat: ''
    };

    // == App.processCode() ==
    //
    // Splits {{{code}}} in documented blocks and puts them in {{{div}}}.
    // The used structure for each block is:
    // {{{
    // <div class="documentation"> (...) </div>
    // <pre class="code prettyprint"> (...) </pre>
    // <div class="divider"/>
    // }}}
    // Documentation is parsed using [[http://wikicreole.org/|Creole]].

    App.processCode = function processCode(code, div) {
        var lines = code.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n');
        var blocks = [];
        var blockText = "";
        var codeText = "";
        var firstCommentLine;
        var lastCommentLine;

        function maybeAppendBlock() {
            if (blockText)
                blocks.push({text: blockText,
                             lineno: firstCommentLine,
                             numLines: lastCommentLine - firstCommentLine + 1,
                             code: codeText});
        }

        $.each(
            lines,
            function(lineNum) {
                var line = this;
                var isCode = true;
                var isComment = (App.trim(line).indexOf("//") === 0);
                if (isComment) {
                    var startIndex = line.indexOf("//");
                    var text = App.trim(line.slice(startIndex + 3));
                    if (lineNum == lastCommentLine + 1) {
                        blockText += text + "\n";
                        lastCommentLine += 1;
                        isCode = false;
                    } else if (text.charAt(0) == "=" || text.charAt(0) == "*") {
                        maybeAppendBlock();
                        firstCommentLine = lineNum;
                        lastCommentLine = lineNum;
                        blockText = text + "\n";
                        codeText = "";
                        isCode = false;
                    }
                }
                if (isCode) {
                    var sublines = 0;
                    var offset = 0;
                    while(offset < line.length) {
                        var subline_length = App.CHARS_PER_ROW-2;
                        if(sublines === 0)
                            subline_length = App.CHARS_PER_ROW-1;
                        var subline = line.substr(offset, subline_length);
                        offset += subline_length;
                        codeText += subline;
                        if((line.length - offset) > 0)
                            codeText += "↩\r\n↪";
                        else
                            codeText += "\r\n";
                    }
                }
            });
        maybeAppendBlock();

        var creole = new WikiCreole.Creole(App.CREOLE);

        $.each(
            blocks,
            function(i) {
                var docs = $('<div class="documentation">');
                $(docs).css(App.docColumnCss);
                creole.parse(docs.get(0), this.text);
                $(div).append(docs);
                var top_padding = 0;
                $('p:first', docs).prevAll().each(function() {
                    top_padding += $(this).outerHeight(true);
                });
                var code = $('<pre class="code prettyprint">');
                $(code).css(App.codeColumnCss);
                if(top_padding)
                    $(code).css({ 'padding-top': top_padding });
                code.text(this.code);
                $(div).append(code);

                // Make sure the block ends with a blank line to make it high
                // enough. For IE8 an extra space is needed, because otherwise
                // the \n is ignored.  FIXME: This doesn't fix issue 13 in IE7
                // yet.
                code.append('\n ');

                var docsSurplus = docs.height() - code.height() + 1;
                if (docsSurplus > 0)
                    code.css({paddingBottom: docsSurplus + "px"});

                $(div).append('<div class="divider">');
            });

        // Run the user-defined processors.
        $.each(
            App.processors,
            function(i) {
                App.processors[i]($(div).find(".documentation"));
            });
    };

    // == App.currentPage ==
    //
    // The current displayed document.

    App.currentPage = null;

    // == App.currentPage ==
    //
    // The current {{{window.location.hash}}}.
    // If the monitoring routing detects a difference between this value
    // and {{{window.location.hash}}},
    // the user is navigated to the new page or element.

    App.currentHash = null;

    // == App.pages ==
    //
    // The has containing all the pages (Javascript files) for this folder.

    App.pages = {};

    // == App.scrollTo() ==
    //
    // Searches the page for a title ({{{h[123456]}}} element)
    // whose content contains {{{element}}}.
    //
    // If such an item is found, scrolls the page down to that element.
    //
    // This is used for intra-documentation links,
    // as implemented by [[#docs.js@App.navigate()|App.navigate()]]

    App.scrollTo = function scrollTo(element) {
        var selected = null;
        if(element) {
            $('h1,h2,h3,h4,h5,h6').each(function() {
                if ((selected === null) &&
                    (App.trim($(this).text()) == element))
                    selected = $(this);
            });
        }
        if (selected)
            $(document).scrollTop(selected.offset().top);
        else
            $(document).scrollTop(0);
    };

    // == App.navigate() ==
    //
    // Navigates to a different view if needed.  The appropriate view is
    // fetched from the URL hash.  If that is empty, the original page content
    // is shown.

    App.navigate = function navigate() {
        var newPage;
        var element = null;
        if (window.location.hash) {
            var components = window.location.hash.split('@', 2);
            newPage = components[0].slice(1);
            if (components.length > 0)
                element = components[1];
        }
        else {
            newPage = "overview";
        }

        if (App.currentPage)
            $(App.pages[App.currentPage]).hide();
        if (!App.pages[newPage]) {
            var newDiv = $("<div>");
            newDiv.attr("name", newPage);
            $("#content").append(newDiv);
            App.pages[newPage] = newDiv;
            $.get(newPage,
                  {},
                  function(code) {
                      App.processCode(code, newDiv);
                      prettyPrint();
                  },
                  "text");
        }
        $(App.pages[newPage]).show();
        App.currentPage = newPage;

        App.scrollTo(element);
    };

    // == App.CHARS_PER_ROW ==
    //
    // The number of characters per row on the code pane.
    // Code lines that are longer than {{{App.CHARS_PER_ROW}}}
    // are wrapped a la Emacs.

    App.CHARS_PER_ROW = 80;

    // == App.initColumnSizes() ==
    //
    // Looks at the viewport and determines the width of the panes,
    // appliying the needed CSS styles to them.

    App.initColumnSizes = function initSizes() {
        // Get the width of a single monospaced character of code.
        var oneCodeCharacter = $('<div class="code">M</div>');
        $("#content").append(oneCodeCharacter);
        App.charWidth = oneCodeCharacter.width();
        $(oneCodeCharacter).remove();
        var totalWidth = $("#content").innerWidth();
        var padding = App.charWidth * 2;
        var paddingPercentage = Math.round(((padding * 2) / totalWidth) * 100);
        App.columnWidth = Math.floor(
            ((App.charWidth * App.CHARS_PER_ROW) /
             totalWidth) * 100) + paddingPercentage;

        // Dynamically determine the column widths and padding based on
        // the font size.
        App.codeColumnCss = {
            width: App.columnWidth+"%",
            paddingLeft: padding,
            paddingRight: padding
        };
        App.docColumnCss = {
            width: (97 - paddingPercentage - App.columnWidth) + "%",
            paddingLeft: padding,
            paddingRight: padding
        };
        $(".documentation").css(App.docColumnCss);
        $(".code").css(App.codeColumnCss);
    };

    // == Initialization code ==
    //
    // Loads the {{{App}}}, initializes it,
    // sets up the location monitoring
    // and launches navigation.

    $(window).ready(
        function() {
            App.pages["overview"] = $("#overview").get(0);
            App.initColumnSizes();
            window.setInterval(
                function() {
                    if(window.location.hash &&
                       window.location.hash != App.currentHash) {
                        App.navigate();
                        App.currentHash = window.location.hash;
                    }
                },
                100);
            App.navigate();
        });
})(jQuery);
