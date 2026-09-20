# Typeset Audit

This is a review-only scan for likely visual punctuation and bidi issues in the built typeset output. It does not edit source files.

PDF scanned: `Files/09 - Misc/Final Sefer/Final Sefer.pdf`
Typst scanned: `Files/09 - Misc/Final Sefer/Final Sefer.typ`
Findings: 29 (2 high, 27 medium)
Visual pages rendered: `typeset-audit-pages`

The PDF scan uses extracted visual text, so it is useful for catching rendered punctuation surprises. The Typst scan catches raw source patterns before rendering.

## HIGH - leading punctuation before Hebrew

- PDF visual text, page 212, Emor 5784, line 11
  - visual: [page-0212.png](typeset-audit-pages/page-0212.png)
  - hardly fathom.)⁩ ⁧,‫ ַאל ִּת ְהיּו ַכֲעָבִד ים ַהְמַׁשְּמִׁשין ֶאת ָהַר ב ַעל ְמָנת ְלַקֵּבל ְּפָר...
  - normalized: hardly fathom.) , ַאל ִּת ְהיּו ַכֲעָבִד ים ַהְמַׁשְּמִׁשין ֶאת ָהַר ב ַעל ְמָנת ְלַקֵּבל ְּפָר סה,...
- PDF visual text, page 464, Shabbos - The Gift of Olam Haba in This World, line 17
  - visual: [page-0464.png](typeset-audit-pages/page-0464.png)
  - The ⁧‫ ⁩גמרא‬says, ⁧,‫ אמר להם הקדוש ברוך הוא למשה‬,‫ כי אני ה’ מקדשכם‬,‫ לדעת‬,‫תני נמי הכי‬
  - normalized: The  גמראsays, , אמר להם הקדוש ברוך הוא למשה, כי אני ה’ מקדשכם, לדעתת,ני נמי הכי
## MEDIUM - missing space after colon before Hebrew in Typst source

- Typst source, page 63, Chayai Sara 5787, line 1884
  - visual: [page-0063.png](typeset-audit-pages/page-0063.png)
  - מ״ט:י״ז)⁩: ⁧אַל תִּירָא כִּי יַעֲשִׁר אִישׁ כִּי יִרְבֶּה כְּבוֹד בֵּיתוֹ⁩ - Don't be...
  - normalized: מ״ט:י״ז): אַל תִּירָא כִּי יַעֲשִׁר אִישׁ כִּי יִרְבֶּה כְּבוֹד בֵּיתוֹ - Don't be af...
- Typst source, page 136, Mishpatim (1) 5784, line 4341
  - visual: [page-0136.png](typeset-audit-pages/page-0136.png), [page-0137.png](typeset-audit-pages/page-0137.png)
  - כ״א:ל״ז)⁩: ⁧כִּי יִגְנֹב אִישׁ שׁוֹר אוֹ שֶׂה וּטְבָחוֹ אוֹ מְכָרוֹ חֲמִשָּׁה בָקָר י...
  - normalized: כ״א:ל״ז): כִּי יִגְנֹב אִישׁ שׁוֹר אוֹ שֶׂה וּטְבָחוֹ אוֹ מְכָרוֹ חֲמִשָּׁה בָקָר יְש...
- Typst source, page 148, Tetzaveh 5783, line 4766
  - visual: [page-0148.png](typeset-audit-pages/page-0148.png), [page-0149.png](typeset-audit-pages/page-0149.png)
  - כ״ט:ל״ט)⁩⁩, referring to the ⁧קרבן תמיד⁩.
  - normalized: כ״ט:ל״ט), referring to the קרבן תמיד.
- Typst source, page 157, Ki Sisa 5783, line 5050
  - visual: [page-0156.png](typeset-audit-pages/page-0156.png), [page-0157.png](typeset-audit-pages/page-0157.png)
  - ל״ד:ל״ג)⁩: ⁧וַיִּתֵּן עַל פָּנָיו מַסְוֶה⁩ - When ⁧משה רבינו⁩ spoke to the people, th...
  - normalized: ל״ד:ל״ג): וַיִּתֵּן עַל פָּנָיו מַסְוֶה - When משה רבינו spoke to the people, they
- Typst source, page 279, Pinchas 5785, line 9166
  - visual: [page-0279.png](typeset-audit-pages/page-0279.png), [page-0280.png](typeset-audit-pages/page-0280.png)
  - א׳:ג׳)⁩: ⁧וַיְצַו אֶת שְׁלֹמֹה בְנוֹ לֵאמֹר אָנֹכִי הֹלֵךְ בְּדֶרֶךְ כׇּל הָאָרֶץ⁩ -...
  - normalized: א׳:ג׳): וַיְצַו אֶת שְׁלֹמֹה בְנוֹ לֵאמֹר אָנֹכִי הֹלֵךְ בְּדֶרֶךְ כׇּל הָאָרֶץ - I'...
- Typst source, page 286, Matos-Massei 5785, line 9378
  - visual: [page-0286.png](typeset-audit-pages/page-0286.png), [page-0287.png](typeset-audit-pages/page-0287.png)
  - shouldn't daven that her son would die. It's brought down in ⁦מכות ב:ו⁩:
  - normalized: shouldn't daven that her son would die. It's brought down in מכות ב:ו:
- Typst source, page 290, Devarim 5784, line 9550
  - visual: [page-0290.png](typeset-audit-pages/page-0290.png)
  - pasuk in ⁦זכריה א׳:ט״ז⁩: ⁧שַׁבְתִּי לִירוּשָׁלַם בְּרַחֲמִים⁩. Another is what we say three
  - normalized: pasuk in זכריה א׳:ט״ז: שַׁבְתִּי לִירוּשָׁלַם בְּרַחֲמִים. Another is what we say three
- Typst source, page 302, Eikev 5784, line 9962
  - visual: [page-0302.png](typeset-audit-pages/page-0302.png), [page-0303.png](typeset-audit-pages/page-0303.png)
  - א׳:ב׳)⁩⁩, and then it says ⁧אָנֹכִי אָנֹכִי הוּא מְנַחֶמְכֶם ⁦(ישעיהו נ״א:י״ב)⁩⁩ lat...
  - normalized: א׳:ב׳), and then it says אָנֹכִי אָנֹכִי הוּא מְנַחֶמְכֶם                  later on
- Typst source, page 378, Shavuos 5784, line 12480
  - visual: [page-0378.png](typeset-audit-pages/page-0378.png), [page-0379.png](typeset-audit-pages/page-0379.png)
  - א:נ״ו)⁩ that at ⁧הר סיני⁩⁦,⁩ ⁧כלל ישראל⁩ was sleeping. They went to sleep that
  - normalized: א:נ״ו) that at הר סיני, כלל ישראל was sleeping. They went to sleep that
- Typst source, page 395, Elul 5785, line 13023
  - visual: [page-0395.png](typeset-audit-pages/page-0395.png)
  - כ״ז:ד׳)⁩⁩. What does ⁧דוד המלך⁩ mean by ⁧כׇּל יְמֵי חַיַּי⁩⁦?⁩
  - normalized: כ״ז:ד׳). What does דוד המלך mean by כׇּל יְמֵי חַיַּי?
- Typst source, page 459, Purim 5785, line 15147
  - visual: [page-0459.png](typeset-audit-pages/page-0459.png), [page-0460.png](typeset-audit-pages/page-0460.png)
  - does this connection mean? He brings a ⁧פסוק⁩ from ⁦שמות ד:י״ד⁩: ⁧וְרָאֲךָ וְשָׂמַח בְּלִבּוֹ⁩. What is ⁦אהרן'⁩s ⁧מידה⁩? We all know abou...
  - normalized: does this connection mean? He brings a פסוק from שמות ד:י״ד: וְרָאֲךָ וְשָׂמַח בְּלִבּוֹ. What is אהרן's מידה? We all know about...
## MEDIUM - quote surrounded by spaces

- PDF visual text, page 2, יעקב מנחם רבינוביץ, line 14
  - visual: [page-0002.png](typeset-audit-pages/page-0002.png)
  - ‫נ"י‪ ,‬אחדשכ"ט החו"ש‪ ,‬מאוד שמח ליבי בעת שקבלתי העלים מספר אשר יכונה " הדבר בי"‬
  - normalized: נ"י א,חדשכ"ט החו"ש מ,אוד שמח ליבי בעת שקבלתי העלים מספר אשר יכונה " הדבר בי"
- PDF visual text, page 15, About the Name, line 27
  - visual: [page-0015.png](typeset-audit-pages/page-0015.png)
  - Zeidy as the ⁧“‫ ⁩”ַּמְלָאְך‬in this pasuk feels natural, as anyone who knows him
  - normalized: Zeidy as the “ ”ַּמְלָאְךin this pasuk feels natural, as anyone who knows him
- PDF visual text, page 39, asked him, “Did you daven during those 40 days?” “What a question! Three, line 5
  - visual: [page-0039.png](typeset-audit-pages/page-0039.png)
  - times a day, of course!” “Did you read any ⁧‫“ ”?⁩תהלים‬Of course,” answered
  - normalized: times a day, of course!” “Did you read any “ ”?תהליםOf course,” answered
- PDF visual text, page 42, Lech Lecha 5784, line 9
  - visual: [page-0042.png](typeset-audit-pages/page-0042.png)
  - ‫ ⁩ְׁשֶמָך‬refers to ⁧‫⁩ֵוֱאֹלֵקי ַיֲעֹקב‬. ⁧”‫ ⁩“ָיכֹול ִיְהיּו חֹוְת ִמין ְּבֻכָּלן‬- the bracha could have ended
  - normalized: ְׁשֶמָךrefers to ֵוֱאֹלֵקי ַיֲעֹקב. ” “ָיכֹול ִיְהיּו חֹוְת ִמין ְּבֻכָּלן- the bracha could have ended
- PDF visual text, page 42, Lech Lecha 5784, line 10
  - visual: [page-0042.png](typeset-audit-pages/page-0042.png)
  - by saying ⁧”‫ ְּבָך חֹוְת ִמין ְוֹלא ָבֶהם‬,‫ “ַּת ְלמּוד לֹוַמר ֶוְהֵיה ְּבָר ָכה‬,‫ ⁩ָמֵגן...
  - normalized: by saying ” ְּבָך חֹוְת ִמין ְוֹלא ָבֶהם, “ַּת ְלמּוד לֹוַמר ֶוְהֵיה ְּבָר ָכה, ָמֵגן ַאְבָר...
- PDF visual text, page 174, Vayikra 5784, line 17
  - visual: [page-0174.png](typeset-audit-pages/page-0174.png)
  - - “If the ⁧ ‫[ ⁩נשיא‬which refers to the ⁧ ‫ ]⁩מלך‬will do an ⁧ ”‫ ⁩עבירה‬- but rather ⁧ ‫ ⁩ֲאֶׁשר‬
  - normalized: - “If the  [ נשיאwhich refers to the   ]מלךwill do an  ” עבירה- but rather   ֲאֶׁשר
- PDF visual text, page 217, Behar 5784, line 17
  - visual: [page-0217.png](typeset-audit-pages/page-0217.png)
  - “The Weekly Vort ” is relevant.
- PDF visual text, page 260, “What brings you here?”     רב ברוך asked. “Well,” the     אלטע Rebbe replied, “I, line 16
  - visual: [page-0260.png](typeset-audit-pages/page-0260.png)
  - collect ⁧‫“ ?⁩צדקה‬But why didn’t you just teach them the meaning of the word
  - normalized: collect “ ?צדקהBut why didn’t you just teach them the meaning of the word
- PDF visual text, page 265, the     משנה in Pirkei Avos that discusses the     ֲעָׂשָר ה ִנִּסים that happened in the   בית, line 17
  - visual: [page-0265.png](typeset-audit-pages/page-0265.png)
  - one ever said, ⁧”‫ ⁩“צר לי המקום‬- meaning Hashem, who is ⁧‫⁩המקום‬. No one ever
  - normalized: one ever said, ” “צר לי המקום- meaning Hashem, who is המקום. No one ever
- PDF visual text, page 354, Dvar Torah Pesach 5783, line 7
  - visual: [page-0354.png](typeset-audit-pages/page-0354.png)
  - is ⁧‫נח‬,⁩ so he called the sefer ⁧‫” “מנחת חן‬, ⁧‫ ⁩חן‬is ⁧‫ ⁩ח‬- ⁧‫ ⁩נ‬and ⁧‫ ⁩נח‬is ⁧‫ ⁩נ‬- ⁧‫]⁩ח‬, asked us...
  - normalized: is נח, so he called the sefer ” “מנחת חן,  חןis  ח-  נand  נחis  נ- ]ח, asked us a
## MEDIUM - space before sentence punctuation

- PDF visual text, page 5, May all of Klal Yisroel merit a Ksiva V’chasima Tova, and may this Sefer, line 6
  - visual: [page-0005.png](typeset-audit-pages/page-0005.png)
  - “Hakadosh Boruch Hu Y’shalem S’charam .….”
- PDF visual text, page 216, should not be     מבזה or make fun of anyone, and you should certainly be very, line 12
  - visual: [page-0216.png](typeset-audit-pages/page-0216.png)
  - a ⁧ ‫ ⁩כהן‬go to the ⁧ ‫ ⁩קבר‬of ⁧ ‫ ⁩?ר’ שמעון בר יוחאי‬It’s a very interesting ⁧ ‫⁩קשיא‬. We
  - normalized: a   כהןgo to the   קברof   ?ר’ שמעון בר יוחאיIt’s a very interesting  קשיא. We
- PDF visual text, page 298, to start filling in this    בור . It’s too big. I’ll never be able to finish it. Might as, line 26
  - visual: [page-0298.png](typeset-audit-pages/page-0298.png)
  - are you not coming to give a ⁧‫ ⁩שלום עליכם‬to my father-in-law the ⁦‫ ?” ב״ח‬The
  - normalized: are you not coming to give a  שלום עליכםto my father-in-law the  ?” ב״חThe
- PDF visual text, page 416, Sukkos 5786, line 21
  - visual: [page-0416.png](typeset-audit-pages/page-0416.png)
  - Why specifically this “easy ⁧‫?”⁩מצוה‬
  - normalized: Why specifically this “easy ?”מצוה
- PDF visual text, page 457, A rav named R’ Mordechai Sabato explains that since each event in the first, line 28
  - visual: [page-0457.png](typeset-audit-pages/page-0457.png)
  - What are the central words of this ⁧‫ !⁩ׇמׇמ ְר ֳּד ַכי ַהְּיהּוִד י⁧ ?⁩פסוק‬Until ⁦‫⁩’מרדכי‬s name is
  - normalized: What are the central words of this  !ׇמׇמ ְר ֳּד ַכי ַהְּיהּוִד י פסוק?Until ’מרדכיs name is
- PDF visual text, page 466, In addition also, we find something very interesting, According to   נוסח אשכנז ,, line 22
  - visual: [page-0466.png](typeset-audit-pages/page-0466.png)
  - ‫ ⁩הקדוש ברוך הוא‬explained it to ⁧‫⁩משה‬. ⁧‫ ⁩ָאַמר ְלָפָניו‬- ⁧‫ ⁩משה רבינו‬says ⁧!‫ִר ּבֹונֹו ֶׁשל עֹוָלם‬
  - normalized: הקדוש ברוך הואexplained it to משה.  ָאַמר ְלָפָניו-  משה רבינוsays !ִר ּבֹונֹו ֶׁשל עֹוָלם
