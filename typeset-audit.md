# Typeset Audit

This is a review-only scan for likely visual punctuation and bidi issues in the built typeset output. It does not edit source files.

PDF scanned: `Files/09 - Misc/Final Sefer/Final Sefer.pdf`
Typst scanned: `Files/09 - Misc/Final Sefer/Final Sefer.typ`
Findings: 28 (2 high, 26 medium)
Visual pages rendered: `typeset-audit-pages`

The PDF scan uses extracted visual text, so it is useful for catching rendered punctuation surprises. The Typst scan catches raw source patterns before rendering.

## HIGH - leading punctuation before Hebrew

- PDF visual text, page 210, Emor 5784, line 11
  - visual: [page-0210.png](typeset-audit-pages/page-0210.png)
  - hardly fathom.)⁩ ⁧,‫ ַאל ִּת ְהיּו ַכֲעָבִד ים ַהְמַׁשְּמִׁשין ֶאת ָהַר ב ַעל ְמָנת ְלַקֵּבל ְּפָר...
  - normalized: hardly fathom.) , ַאל ִּת ְהיּו ַכֲעָבִד ים ַהְמַׁשְּמִׁשין ֶאת ָהַר ב ַעל ְמָנת ְלַקֵּבל ְּפָר סה,...
- PDF visual text, page 462, Shabbos - The Gift of Olam Haba in This World, line 17
  - visual: [page-0462.png](typeset-audit-pages/page-0462.png)
  - The ⁧‫ ⁩גמרא‬says, ⁧,‫ אמר להם הקדוש ברוך הוא למשה‬,‫ כי אני ה’ מקדשכם‬,‫ לדעת‬,‫תני נמי הכי‬
  - normalized: The  גמראsays, , אמר להם הקדוש ברוך הוא למשה, כי אני ה’ מקדשכם, לדעתת,ני נמי הכי
## MEDIUM - missing space after colon before Hebrew in Typst source

- Typst source, page 61, Chayai Sara 5787, line 1864
  - visual: [page-0061.png](typeset-audit-pages/page-0061.png)
  - מ״ט:י״ז)⁩: ⁧אַל תִּירָא כִּי יַעֲשִׁר אִישׁ כִּי יִרְבֶּה כְּבוֹד בֵּיתוֹ⁩ - Don't be...
  - normalized: מ״ט:י״ז): אַל תִּירָא כִּי יַעֲשִׁר אִישׁ כִּי יִרְבֶּה כְּבוֹד בֵּיתוֹ - Don't be af...
- Typst source, page 134, Mishpatim (1) 5784, line 4322
  - visual: [page-0134.png](typeset-audit-pages/page-0134.png), [page-0135.png](typeset-audit-pages/page-0135.png)
  - כ״א:ל״ז)⁩: ⁧כִּי יִגְנֹב אִישׁ שׁוֹר אוֹ שֶׂה וּטְבָחוֹ אוֹ מְכָרוֹ חֲמִשָּׁה בָקָר י...
  - normalized: כ״א:ל״ז): כִּי יִגְנֹב אִישׁ שׁוֹר אוֹ שֶׂה וּטְבָחוֹ אוֹ מְכָרוֹ חֲמִשָּׁה בָקָר יְש...
- Typst source, page 146, Tetzaveh 5783, line 4747
  - visual: [page-0146.png](typeset-audit-pages/page-0146.png), [page-0147.png](typeset-audit-pages/page-0147.png)
  - כ״ט:ל״ט)⁩⁩, referring to the ⁧קרבן תמיד⁩.
  - normalized: כ״ט:ל״ט), referring to the קרבן תמיד.
- Typst source, page 155, Ki Sisa 5783, line 5031
  - visual: [page-0154.png](typeset-audit-pages/page-0154.png), [page-0155.png](typeset-audit-pages/page-0155.png)
  - ל״ד:ל״ג)⁩: ⁧וַיִּתֵּן עַל פָּנָיו מַסְוֶה⁩ - When ⁧משה רבינו⁩ spoke to the people, th...
  - normalized: ל״ד:ל״ג): וַיִּתֵּן עַל פָּנָיו מַסְוֶה - When משה רבינו spoke to the people, they
- Typst source, page 277, Pinchas 5785, line 9150
  - visual: [page-0277.png](typeset-audit-pages/page-0277.png), [page-0278.png](typeset-audit-pages/page-0278.png)
  - א׳:ג׳)⁩: ⁧וַיְצַו אֶת שְׁלֹמֹה בְנוֹ לֵאמֹר אָנֹכִי הֹלֵךְ בְּדֶרֶךְ כׇּל הָאָרֶץ⁩ -...
  - normalized: א׳:ג׳): וַיְצַו אֶת שְׁלֹמֹה בְנוֹ לֵאמֹר אָנֹכִי הֹלֵךְ בְּדֶרֶךְ כׇּל הָאָרֶץ - I'...
- Typst source, page 284, Matos-Massei 5785, line 9362
  - visual: [page-0284.png](typeset-audit-pages/page-0284.png), [page-0285.png](typeset-audit-pages/page-0285.png)
  - shouldn't daven that her son would die. It's brought down in ⁦מכות ב:ו⁩:
  - normalized: shouldn't daven that her son would die. It's brought down in מכות ב:ו:
- Typst source, page 288, Devarim 5784, line 9534
  - visual: [page-0288.png](typeset-audit-pages/page-0288.png)
  - pasuk in ⁦זכריה א׳:ט״ז⁩: ⁧שַׁבְתִּי לִירוּשָׁלַם בְּרַחֲמִים⁩. Another is what we say three
  - normalized: pasuk in זכריה א׳:ט״ז: שַׁבְתִּי לִירוּשָׁלַם בְּרַחֲמִים. Another is what we say three
- Typst source, page 300, Eikev 5784, line 9946
  - visual: [page-0300.png](typeset-audit-pages/page-0300.png), [page-0301.png](typeset-audit-pages/page-0301.png)
  - א׳:ב׳)⁩⁩, and then it says ⁧אָנֹכִי אָנֹכִי הוּא מְנַחֶמְכֶם ⁦(ישעיהו נ״א:י״ב)⁩⁩ lat...
  - normalized: א׳:ב׳), and then it says אָנֹכִי אָנֹכִי הוּא מְנַחֶמְכֶם                  later on
- Typst source, page 376, Shavuos 5784, line 12464
  - visual: [page-0376.png](typeset-audit-pages/page-0376.png), [page-0377.png](typeset-audit-pages/page-0377.png)
  - א:נ״ו)⁩ that at ⁧הר סיני⁩⁦,⁩ ⁧כלל ישראל⁩ was sleeping. They went to sleep that
  - normalized: א:נ״ו) that at הר סיני, כלל ישראל was sleeping. They went to sleep that
- Typst source, page 393, Elul 5785, line 13006
  - visual: [page-0393.png](typeset-audit-pages/page-0393.png)
  - כ״ז:ד׳)⁩⁩. What does ⁧דוד המלך⁩ mean by ⁧כׇּל יְמֵי חַיַּי⁩⁦?⁩
  - normalized: כ״ז:ד׳). What does דוד המלך mean by כׇּל יְמֵי חַיַּי?
- Typst source, page 457, Purim 5785, line 15123
  - visual: [page-0457.png](typeset-audit-pages/page-0457.png), [page-0458.png](typeset-audit-pages/page-0458.png)
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
- PDF visual text, page 352, Dvar Torah Pesach 5783, line 7
  - visual: [page-0352.png](typeset-audit-pages/page-0352.png)
  - is ⁧‫נח‬,⁩ so he called the sefer ⁧‫” “מנחת חן‬, ⁧‫ ⁩חן‬is ⁧‫ ⁩ח‬- ⁧‫ ⁩נ‬and ⁧‫ ⁩נח‬is ⁧‫ ⁩נ‬- ⁧‫]⁩ח‬, asked us...
  - normalized: is נח, so he called the sefer ” “מנחת חן,  חןis  ח-  נand  נחis  נ- ]ח, asked us a
## MEDIUM - space before sentence punctuation

- PDF visual text, page 2, May all of Klal Yisroel merit a Ksiva V’chasima Tova, and may this Sefer, line 6
  - visual: [page-0002.png](typeset-audit-pages/page-0002.png)
  - “Hakadosh Boruch Hu Y’shalem S’charam .….”
- PDF visual text, page 214, should not be     מבזה or make fun of anyone, and you should certainly be very, line 12
  - visual: [page-0214.png](typeset-audit-pages/page-0214.png)
  - a ⁧ ‫ ⁩כהן‬go to the ⁧ ‫ ⁩קבר‬of ⁧ ‫ ⁩?ר’ שמעון בר יוחאי‬It’s a very interesting ⁧ ‫⁩קשיא‬. We
  - normalized: a   כהןgo to the   קברof   ?ר’ שמעון בר יוחאיIt’s a very interesting  קשיא. We
- PDF visual text, page 296, to start filling in this    בור . It’s too big. I’ll never be able to finish it. Might as, line 26
  - visual: [page-0296.png](typeset-audit-pages/page-0296.png)
  - are you not coming to give a ⁧‫ ⁩שלום עליכם‬to my father-in-law the ⁦‫ ?” ב״ח‬The
  - normalized: are you not coming to give a  שלום עליכםto my father-in-law the  ?” ב״חThe
- PDF visual text, page 414, Sukkos 5786, line 21
  - visual: [page-0414.png](typeset-audit-pages/page-0414.png)
  - Why specifically this “easy ⁧‫?”⁩מצוה‬
  - normalized: Why specifically this “easy ?”מצוה
- PDF visual text, page 455, A rav named R’ Mordechai Sabato explains that since each event in the first, line 28
  - visual: [page-0455.png](typeset-audit-pages/page-0455.png)
  - What are the central words of this ⁧‫ !⁩ׇמׇמ ְר ֳּד ַכי ַהְּיהּוִד י⁧ ?⁩פסוק‬Until ⁦‫⁩’מרדכי‬s name is
  - normalized: What are the central words of this  !ׇמׇמ ְר ֳּד ַכי ַהְּיהּוִד י פסוק?Until ’מרדכיs name is
- PDF visual text, page 464, In addition also, we find something very interesting, According to   נוסח אשכנז ,, line 22
  - visual: [page-0464.png](typeset-audit-pages/page-0464.png)
  - ‫ ⁩הקדוש ברוך הוא‬explained it to ⁧‫⁩משה‬. ⁧‫ ⁩ָאַמר ְלָפָניו‬- ⁧‫ ⁩משה רבינו‬says ⁧!‫ִר ּבֹונֹו ֶׁשל עֹוָלם‬
  - normalized: הקדוש ברוך הואexplained it to משה.  ָאַמר ְלָפָניו-  משה רבינוsays !ִר ּבֹונֹו ֶׁשל עֹוָלם
