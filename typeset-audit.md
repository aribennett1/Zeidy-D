# Typeset Audit

This is a review-only scan for likely visual punctuation and bidi issues in the built typeset output. It does not edit source files.

PDF scanned: `Files/09 - Misc/Final Sefer/Final Sefer.pdf`
Typst scanned: `Files/09 - Misc/Final Sefer/Final Sefer.typ`
Findings: 35 (2 high, 33 medium)
Visual pages rendered: `typeset-audit-pages`

The PDF scan uses extracted visual text, so it is useful for catching rendered punctuation surprises. The Typst scan catches raw source patterns before rendering.

## HIGH - leading punctuation before Hebrew

- PDF visual text, page 210, Emor 5784, line 11
  - visual: [page-0210.png](typeset-audit-pages/page-0210.png)
  - hardly fathom.)⁩ ⁧,‫ ַאל ִּת ְהיּו ַכֲעָבִד ים ַהְמַׁשְּמִׁשין ֶאת ָהַר ב ַעל ְמָנת ְלַקֵּבל ְּפָר...
  - normalized: hardly fathom.) , ַאל ִּת ְהיּו ַכֲעָבִד ים ַהְמַׁשְּמִׁשין ֶאת ָהַר ב ַעל ְמָנת ְלַקֵּבל ְּפָר סה,...
- PDF visual text, page 475, לטובה - the same way, also all of the     גלות and all of the     גלות in the Yidden, line 6
  - visual: [page-0475.png](typeset-audit-pages/page-0475.png)
  - ,‫ גלות יוון‬,‫ ⁩אך בהווה⁧ ⁩;גלות אדום⁧ ⁩גלות בבל‬- but in the present time, ⁦‫לא י...
  - normalized: , גלות יוון, אך בהווה ;גלות אדום גלות בבל- but in the present time, לא יוכל האדם
## MEDIUM - missing space after colon before Hebrew in Typst source

- Typst source, page 61, Chayai Sara 5787, line 1844
  - visual: [page-0061.png](typeset-audit-pages/page-0061.png)
  - מ״ט:י״ז)⁩: ⁧אַל תִּירָא כִּי יַעֲשִׁר אִישׁ כִּי יִרְבֶּה כְּבוֹד בֵּיתוֹ⁩ - Don't be...
  - normalized: מ״ט:י״ז): אַל תִּירָא כִּי יַעֲשִׁר אִישׁ כִּי יִרְבֶּה כְּבוֹד בֵּיתוֹ - Don't be af...
- Typst source, page 134, Mishpatim (1) 5784, line 4302
  - visual: [page-0134.png](typeset-audit-pages/page-0134.png), [page-0135.png](typeset-audit-pages/page-0135.png)
  - כ״א:ל״ז)⁩: ⁧כִּי יִגְנֹב אִישׁ שׁוֹר אוֹ שֶׂה וּטְבָחוֹ אוֹ מְכָרוֹ חֲמִשָּׁה בָקָר י...
  - normalized: כ״א:ל״ז): כִּי יִגְנֹב אִישׁ שׁוֹר אוֹ שֶׂה וּטְבָחוֹ אוֹ מְכָרוֹ חֲמִשָּׁה בָקָר יְש...
- Typst source, page 146, Tetzaveh 5783, line 4727
  - visual: [page-0146.png](typeset-audit-pages/page-0146.png), [page-0147.png](typeset-audit-pages/page-0147.png)
  - כ״ט:ל״ט)⁩⁩, referring to the ⁧קרבן תמיד⁩.
  - normalized: כ״ט:ל״ט), referring to the קרבן תמיד.
- Typst source, page 155, Ki Sisa 5783, line 5011
  - visual: [page-0154.png](typeset-audit-pages/page-0154.png), [page-0155.png](typeset-audit-pages/page-0155.png)
  - ל״ד:ל״ג)⁩: ⁧וַיִּתֵּן עַל פָּנָיו מַסְוֶה⁩ - When ⁧משה רבינו⁩ spoke to the people, th...
  - normalized: ל״ד:ל״ג): וַיִּתֵּן עַל פָּנָיו מַסְוֶה - When משה רבינו spoke to the people, they
- Typst source, page 277, Pinchas 5785, line 9133
  - visual: [page-0277.png](typeset-audit-pages/page-0277.png), [page-0278.png](typeset-audit-pages/page-0278.png)
  - א׳:ג׳)⁩: ⁧וַיְצַו אֶת שְׁלֹמֹה בְנוֹ לֵאמֹר אָנֹכִי הֹלֵךְ בְּדֶרֶךְ כׇּל הָאָרֶץ⁩ -...
  - normalized: א׳:ג׳): וַיְצַו אֶת שְׁלֹמֹה בְנוֹ לֵאמֹר אָנֹכִי הֹלֵךְ בְּדֶרֶךְ כׇּל הָאָרֶץ - I'...
- Typst source, page 284, Matos-Massei 5785, line 9345
  - visual: [page-0284.png](typeset-audit-pages/page-0284.png), [page-0285.png](typeset-audit-pages/page-0285.png)
  - shouldn't daven that her son would die. It's brought down in ⁦מכות ב:ו⁩:
  - normalized: shouldn't daven that her son would die. It's brought down in מכות ב:ו:
- Typst source, page 288, Devarim 5784, line 9517
  - visual: [page-0288.png](typeset-audit-pages/page-0288.png)
  - pasuk in ⁦זכריה א׳:ט״ז⁩: ⁧שַׁבְתִּי לִירוּשָׁלַם בְּרַחֲמִים⁩. Another is what we say three
  - normalized: pasuk in זכריה א׳:ט״ז: שַׁבְתִּי לִירוּשָׁלַם בְּרַחֲמִים. Another is what we say three
- Typst source, page 300, Eikev 5784, line 9929
  - visual: [page-0300.png](typeset-audit-pages/page-0300.png), [page-0301.png](typeset-audit-pages/page-0301.png)
  - א׳:ב׳)⁩⁩, and then it says ⁧אָנֹכִי אָנֹכִי הוּא מְנַחֶמְכֶם ⁦(ישעיהו נ״א:י״ב)⁩⁩ lat...
  - normalized: א׳:ב׳), and then it says אָנֹכִי אָנֹכִי הוּא מְנַחֶמְכֶם                  later on
- Typst source, page 377, Shavuos 5784, line 12458
  - visual: [page-0377.png](typeset-audit-pages/page-0377.png), [page-0378.png](typeset-audit-pages/page-0378.png)
  - א:נ״ו)⁩ that at ⁧הר סיני⁩⁦,⁩ ⁧כלל ישראל⁩ was sleeping. They went to sleep that
  - normalized: א:נ״ו) that at הר סיני, כלל ישראל was sleeping. They went to sleep that
- Typst source, page 394, Elul 5785, line 13000
  - visual: [page-0394.png](typeset-audit-pages/page-0394.png)
  - כ״ז:ד׳)⁩⁩. What does ⁧דוד המלך⁩ mean by ⁧כׇּל יְמֵי חַיַּי⁩⁦?⁩
  - normalized: כ״ז:ד׳). What does דוד המלך mean by כׇּל יְמֵי חַיַּי?
- Typst source, page 458, Purim 5785, line 15125
  - visual: [page-0458.png](typeset-audit-pages/page-0458.png), [page-0459.png](typeset-audit-pages/page-0459.png)
  - does this connection mean? He brings a ⁧פסוק⁩ from ⁦שמות ד:י״ד⁩: ⁧וְרָאֲךָ וְשָׂמַח בְּלִבּוֹ⁩. What is ⁦אהרן'⁩s ⁧מידה⁩? We all know abou...
  - normalized: does this connection mean? He brings a פסוק from שמות ד:י״ד: וְרָאֲךָ וְשָׂמַח בְּלִבּוֹ. What is אהרן's מידה? We all know about...
## MEDIUM - quote surrounded by spaces

- PDF visual text, page 12, About the Name, line 27
  - visual: [page-0012.png](typeset-audit-pages/page-0012.png)
  - Zeidy as the ⁧“‫ ⁩”ַּמְלָאְך‬in this pasuk feels natural, as anyone who knows him
  - normalized: Zeidy as the “ ”ַּמְלָאְךin this pasuk feels natural, as anyone who knows him
- PDF visual text, page 37, asked him, “Did you daven during those 40 days?” “What a question! Three, line 5
  - visual: [page-0037.png](typeset-audit-pages/page-0037.png)
  - times a day, of course!” “Did you read any ⁧‫“ ”?⁩תהלים‬Of course,” answered
  - normalized: times a day, of course!” “Did you read any “ ”?תהליםOf course,” answered
- PDF visual text, page 40, Lech Lecha 5784, line 9
  - visual: [page-0040.png](typeset-audit-pages/page-0040.png)
  - ‫ ⁩ְׁשֶמָך‬refers to ⁧‫⁩ֵוֱאֹלֵקי ַיֲעֹקב‬. ⁧”‫ ⁩“ָיכֹול ִיְהיּו חֹוְת ִמין ְּבֻכָּלן‬- the bracha could have ended
  - normalized: ְׁשֶמָךrefers to ֵוֱאֹלֵקי ַיֲעֹקב. ” “ָיכֹול ִיְהיּו חֹוְת ִמין ְּבֻכָּלן- the bracha could have ended
- PDF visual text, page 40, Lech Lecha 5784, line 10
  - visual: [page-0040.png](typeset-audit-pages/page-0040.png)
  - by saying ⁧”‫ ְּבָך חֹוְת ִמין ְוֹלא ָבֶהם‬,‫ “ַּת ְלמּוד לֹוַמר ֶוְהֵיה ְּבָר ָכה‬,‫ ⁩ָמֵגן...
  - normalized: by saying ” ְּבָך חֹוְת ִמין ְוֹלא ָבֶהם, “ַּת ְלמּוד לֹוַמר ֶוְהֵיה ְּבָר ָכה, ָמֵגן ַאְבָר...
- PDF visual text, page 172, Vayikra 5784, line 17
  - visual: [page-0172.png](typeset-audit-pages/page-0172.png)
  - - “If the ⁧ ‫[ ⁩נשיא‬which refers to the ⁧ ‫ ]⁩מלך‬will do an ⁧ ”‫ ⁩עבירה‬- but rather ⁧ ‫ ⁩ֲאֶׁשר‬
  - normalized: - “If the  [ נשיאwhich refers to the   ]מלךwill do an  ” עבירה- but rather   ֲאֶׁשר
- PDF visual text, page 215, Behar 5784, line 17
  - visual: [page-0215.png](typeset-audit-pages/page-0215.png)
  - “The Weekly Vort ” is relevant.
- PDF visual text, page 258, “What brings you here?”     רב ברוך asked. “Well,” the     אלטע Rebbe replied, “I, line 16
  - visual: [page-0258.png](typeset-audit-pages/page-0258.png)
  - collect ⁧‫“ ?⁩צדקה‬But why didn’t you just teach them the meaning of the word
  - normalized: collect “ ?צדקהBut why didn’t you just teach them the meaning of the word
- PDF visual text, page 263, the     משנה in Pirkei Avos that discusses the     ֲעָׂשָר ה ִנִּסים that happened in the   בית, line 17
  - visual: [page-0263.png](typeset-audit-pages/page-0263.png)
  - one ever said, ⁧”‫ ⁩“צר לי המקום‬- meaning Hashem, who is ⁧‫⁩המקום‬. No one ever
  - normalized: one ever said, ” “צר לי המקום- meaning Hashem, who is המקום. No one ever
- PDF visual text, page 353, Dvar Torah Pesach 5783, line 7
  - visual: [page-0353.png](typeset-audit-pages/page-0353.png)
  - is ⁧‫נח‬,⁩ so he called the sefer ⁧‫” “מנחת חן‬, ⁧‫ ⁩חן‬is ⁧‫ ⁩ח‬- ⁧‫ ⁩נ‬and ⁧‫ ⁩נח‬is ⁧‫ ⁩נ‬- ⁧‫]⁩ח‬, asked us...
  - normalized: is נח, so he called the sefer ” “מנחת חן,  חןis  ח-  נand  נחis  נ- ]ח, asked us a
## MEDIUM - space before sentence punctuation

- PDF visual text, page 2, May all of Klal Yisroel merit a Ksiva V’chasima Tova, and may this Sefer, line 6
  - visual: [page-0002.png](typeset-audit-pages/page-0002.png)
  - “Hakadosh Boruch Hu Y’shalem S’charam .….”
- PDF visual text, page 31, who knew, hummed along with me. This went on for a few moments. After, line 11
  - visual: [page-0031.png](typeset-audit-pages/page-0031.png)
  - words ⁧‫ ⁩לכבוד‬the ⁧,‫ ”⁩שמחה‬he again urged me.
  - normalized: words  לכבודthe , ”שמחהhe again urged me.
- PDF visual text, page 108, witnessed the oil flowing over    ’ַאֲהֹרן s head, down his face, and onto his beard., line 7
  - visual: [page-0108.png](typeset-audit-pages/page-0108.png)
  - to ⁧‫ ⁩כהן גדול‬was entirely genuine. From this ⁧,‫⁩’רבי יהושע בן קרחה⁦ ⁩מדרש‬s position
  - normalized: to  כהן גדולwas entirely genuine. From this ,’רבי יהושע בן קרחה מדרשs position
- PDF visual text, page 127, Yisro 5783, line 27
  - visual: [page-0127.png](typeset-audit-pages/page-0127.png)
  - “I accept upon myself to become ⁦ ‫⁩’ראובן‬s ⁧ ,‫ ”⁩עבד‬he automatically assumes
  - normalized: “I accept upon myself to become  ’ראובןs  , ”עבדhe automatically assumes
- PDF visual text, page 138, - Don’t rush to     דן him to    מיתה . Just as ascending the     מזבח requires deliberate, line 24
  - visual: [page-0138.png](typeset-audit-pages/page-0138.png)
  - is driving on ⁧,‫ ”⁩שבת‬the child exclaimed. The father calmly responded, “He’s
  - normalized: is driving on , ”שבתthe child exclaimed. The father calmly responded, “He’s
- PDF visual text, page 145, is     מקדים the     רפואה before the  ,  ” מכה He creates the     רפואה before He creates the, line 4
  - visual: [page-0145.png](typeset-audit-pages/page-0145.png)
  - is ⁧‫ ⁩מקדים‬the ⁧‫ ⁩רפואה‬before the ⁧,‫ ”⁩מכה‬He creates the ⁧‫ ⁩רפואה‬before He creates the
  - normalized: is  מקדיםthe  רפואהbefore the , ”מכהHe creates the  רפואהbefore He creates the
- PDF visual text, page 217, Bechukosai 5784, line 11
  - visual: [page-0217.png](typeset-audit-pages/page-0217.png)
  - keep the ⁧,‫ ”⁩תורה‬which we are about to reaccept on ⁧‫שבועות‬,⁩ “then I will give
  - normalized: keep the , ”תורהwhich we are about to reaccept on שבועות, “then I will give
- PDF visual text, page 281, R’ Chaim immediately responded,     “חולה doesn’t mean sick in this context., line 5
  - visual: [page-0281.png](typeset-audit-pages/page-0281.png)
  - It means dancing, as in ⁧ ,‫ ”⁩מחול‬as the ⁧ ‫ ⁩משנה‬in ⁧ ‫ ⁩תענית‬says: ⁧ ‫יוצאות במחולות‬
  - normalized: It means dancing, as in  , ”מחולas the   משנהin   תעניתsays:  יוצאות במחולות
- PDF visual text, page 283, מותר ,  is now     אסור to me, it’s a     הזיק to his     נשמה in exactly the same way as     חזיר, line 16
  - visual: [page-0283.png](typeset-audit-pages/page-0283.png)
  - “This is ⁧,‫ ”⁩תרומה‬it’s now ⁧‫⁩תרומה‬. If a ⁧‫ ⁩זר‬eats that, he’s ⁧‫⁩חייב כרת‬. So you...
  - normalized: “This is , ”תרומהit’s now תרומה. If a  זרeats that, he’s חייב כרת. So you can take
- PDF visual text, page 296, to start filling in this    בור . It’s too big. I’ll never be able to finish it. Might as, line 26
  - visual: [page-0296.png](typeset-audit-pages/page-0296.png)
  - are you not coming to give a ⁧‫ ⁩שלום עליכם‬to my father-in-law the ⁦‫ ?” ב״ח‬The
  - normalized: are you not coming to give a  שלום עליכםto my father-in-law the  ?” ב״חThe
- PDF visual text, page 415, Sukkos 5786, line 18
  - visual: [page-0415.png](typeset-audit-pages/page-0415.png)
  - will say, “Okay, I’ll give you a ⁧,‫ ”⁩מצוה‬and He’ll give them the ⁧‫ ⁩מצוה‬of ⁧‫סוכה‬,⁩
  - normalized: will say, “Okay, I’ll give you a , ”מצוהand He’ll give them the  מצוהof סוכה,
- PDF visual text, page 415, Sukkos 5786, line 21
  - visual: [page-0415.png](typeset-audit-pages/page-0415.png)
  - this “easy ⁧‫?”⁩מצוה‬
  - normalized: this “easy ?”מצוה
- PDF visual text, page 456, A rav named R’ Mordechai Sabato explains that since each event in the first, line 28
  - visual: [page-0456.png](typeset-audit-pages/page-0456.png)
  - What are the central words of this ⁧‫ !⁩ׇמׇמ ְר ֳּד ַכי ַהְּיהּוִד י⁧ ?⁩פסוק‬Until ⁦‫⁩’מרדכי‬s name is
  - normalized: What are the central words of this  !ׇמׇמ ְר ֳּד ַכי ַהְּיהּוִד י פסוק?Until ’מרדכיs name is
