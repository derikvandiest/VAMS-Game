/**
 * Ms. Williams's (8th grade IET · Lead IET) handout: "Both/And: Supporting Multilingual Learners with IEPs in Middle
 * School". Drawn from assets/MLLs-with-IEPs-Middle-School-Room-Blueprint.md, mainly the CDE's California
 * Practitioners' Guide for Educating English Learners with Disabilities (2019), plus the research and policy listed in
 * its Sources. Shown and printed by handout.ts.
 */
export const IEP_HANDOUT_HTML = `
<header class="ho-head">
  <div class="ho-kicker">Valor Academy · Inclusive Education</div>
  <h1>Both / And</h1>
  <p class="ho-sub">Supporting multilingual learners (MLLs) with IEPs in middle school</p>
  <p class="ho-from">From Ms. Williams, 8th Grade IET · Lead IET</p>
</header>

<section>
  <h2>Who are our dually identified students?</h2>
  <div class="ho-stats">
    <div class="ho-stat"><b>~177,000</b><span>California students are both MLLs and students with disabilities (about 3% of K–12). That's ~17.5% of all MLLs and ~21% of all students with disabilities.</span></div>
    <div class="ho-stat"><b>1 in 3</b><span>become Long-Term English Learners (LTELs), compared with about 12% of MLLs without disabilities. Only 60% are reclassified by grade 12 (vs. 75%).</span></div>
    <div class="ho-stat"><b>75% vs. 91%</b><span>graduate with a regular diploma, compared with students with neither label. 44% enroll in college (vs. 66%).</span></div>
  </div>
  <cite>Artiles &amp; Souto-Maior, Getting Down to Facts / Stanford (2014-15 to 2024-25 data)</cite>
  <p class="ho-note"><b>Middle school matters:</b> dually identified students are concentrated in the upper-elementary and middle grades, and many are LTELs: socially fluent in English, but stuck in academic English for 6+ years. In some California districts, LTELs were placed in special education at 2–4 times the rate of non-ELs (Californians Together, 2015).</p>
</section>

<section>
  <h2>The core belief: BOTH, not either/or</h2>
  <div class="ho-big">These students are entitled to <b>English language development</b> services <b>and</b> <b>special education</b> services. One never replaces the other.</div>
  <ul class="ho-rules">
    <li><b>Federal law:</b> Title VI, IDEA and the EEOA require both language assistance and disability-related services. (The 2015 federal "Dear Colleague" letter was rescinded in 2025, but those laws still apply.)</li>
    <li><b>California:</b> ELD is part of every language acquisition program, so ELD must be addressed for <b>every</b> English learner with an IEP (CA Practitioners' Guide, Ch. 5).</li>
    <li><b>CA EL Roadmap:</b> assets-oriented, high expectations and meaningful access to grade-level content, for dually identified students too.</li>
  </ul>
</section>

<section>
  <h2>Language difference or disability?</h2>
  <p>Schools make two mistakes: <b>over-identifying</b> normal second-language acquisition as a disability, and <b>waiting too long</b> ("let's wait until their English is better") when a student really needs help. In California, <b>limited English proficiency is never a basis for special education eligibility.</b></p>
  <div class="ho-key">🔑 The key test: does the difficulty show up in <b>BOTH languages</b>, <b>across settings</b>, <b>over time</b>?</div>
  <table class="ho-table">
    <tr><th>What you see</th><th>Likely a language difference</th><th>Possible disability</th></tr>
    <tr><td>Doesn't follow verbal directions</td><td>Lacks English vocabulary but understands in L1</td><td>Consistently confused in both L1 and L2</td></tr>
    <tr><td>Slow to respond</td><td>May be translating in their head; improves over time</td><td>Consistently slow in both languages; no change over time</td></tr>
    <tr><td>Can't retell a story</td><td>Limited English or background knowledge</td><td>Difficulty retelling in L1 and L2</td></tr>
    <tr><td>Says very little</td><td>Understands more than they can say yet</td><td>Speaks little in either language</td></tr>
    <tr><td>Forgets letter-sound patterns</td><td>Sounds differ between L1 and L2 at first, then improve</td><td>Doesn't retain sounds, even ones both languages share</td></tr>
  </table>
  <h3 class="ho-group">Before referring an MLL, the student study team asks</h3>
  <ul class="ho-check">
    <li>Has the student had core instruction designed for English learners (integrated <i>and</i> designated ELD)?</li>
    <li>Have evidence-based interventions for ELs been used with fidelity over time, with little or no progress in the data?</li>
    <li>How does the student's rate of learning compare with similar EL peers ("true peers")?</li>
    <li>Have we talked with the family about learning patterns and language use at home?</li>
    <li>Are the error patterns similar in the primary language, or typical of second-language learners?</li>
    <li>Do the difficulties appear across settings, and have other explanations been ruled out?</li>
  </ul>
  <p class="ho-note"><b>LTEL red flag:</b> before moving an LTEL into Tier II/III or special education, ask: <i>"Is the lack of progress due to the student, or to years of inadequate ELD and core instruction?"</i> Too many LTELs in intervention or special ed is a <b>system</b> signal, not just an individual one.</p>
</section>

<section>
  <h2>The IEP for an English learner</h2>
  <div class="ho-two">
    <div class="ho-card">
      <h3>It must include</h3>
      <ul class="ho-check">
        <li>The student's EL (or reclassified) status</li>
        <li>ELPAC results in all 4 domains in the present levels (and primary-language performance when feasible)</li>
        <li>ELPAC accessibility resources for each domain</li>
        <li><b>How</b> integrated and designated ELD will be provided, and <b>who</b> provides it</li>
        <li>Primary language support, the language of instruction and the program type</li>
        <li>Linguistically appropriate goals (LAGOS)</li>
      </ul>
      <cite>CA Practitioners' Guide, Ch. 5</cite>
    </div>
    <div class="ho-card">
      <h3>LAGOS: linguistically appropriate goals</h3>
      <p>Required for students whose primary language isn't English (Ed Code §56345(b)(2); 5 CCR §3001). LAGOS aren't separate "ELD goals": they're IEP goals linked to <b>a grade-level standard AND a CA ELD standard</b> at the student's proficiency level.</p>
      <ol class="ho-list">
        <li>Review ELPAC results for language areas to develop.</li>
        <li>Review data for areas of disability-related need.</li>
        <li>Link the goal to a grade-level standard and an ELD standard.</li>
      </ol>
    </div>
  </div>
  <div class="ho-example">
    <b>7th grade example</b> (CA Practitioners' Guide)
    <p><i>Grade-level standard:</i> CCSS L.7.5, figurative language and nuances in word meanings. <i>ELD standard:</i> Part I, Productive, Expanding: use a growing set of academic and domain-specific words to create precision.</p>
    <p><i>Goal:</i> By (date), after a teacher-led lecture, (student), given a list of vocabulary words, will <b>define each word in their own words and write a sentence with an analogy</b> using it, for <b>4 out of 5</b> words in <b>3 out of 4</b> vocabulary exercises.</p>
  </div>
</section>

<section>
  <h2>Families and interpreters</h2>
  <p>The district must take <b>any action necessary</b> so parents understand the IEP meeting, including arranging an interpreter (Ed Code §56341.5(i)). Check translation timelines for IEP documents with your SELPA.</p>
  <ul class="ho-rules">
    <li>The interpreter sits <b>next to the parent</b> and interprets everything, without summarizing or adding opinions.</li>
    <li><b>Speak to the parent, not the interpreter.</b></li>
    <li>Skip the jargon and acronyms (IEP, LRE, PLOP, LAGOS) or explain them.</li>
    <li><b>Never use the student or a sibling as the interpreter.</b></li>
    <li>Treat the family as the experts on their own child: ask about home language, strengths and history.</li>
    <li>In middle school, invite the <b>student</b> to the table and build self-advocacy.</li>
  </ul>
</section>

<section>
  <h2>Testing and reclassification</h2>
  <table class="ho-table">
    <tr><th>ELPAC option</th><th>When</th></tr>
    <tr><td>Universal tools / designated supports</td><td>Most dually identified students. Decide for <b>each domain</b>.</td></tr>
    <tr><td>Accommodations</td><td>As written in the IEP or 504 plan.</td></tr>
    <tr><td>Domain exemption</td><td>The disability prevents testing a domain even with supports. The exempt domain gets the lowest score, which can lower the overall level.</td></tr>
    <tr><td>Alternate ELPAC</td><td>Only students with the most significant cognitive disabilities who take the CAA. A learning disability or speech/language impairment alone doesn't qualify.</td></tr>
  </table>
  <p class="ho-note"><b>AB 2555:</b> the Summative ELPAC is now the <b>sole</b> reclassification criterion (Overall PL 4, or PL 3 on the Alternate ELPAC; CDE lists Sept 27, 2026 as the effective date, verify locally). So the right ELPAC decisions in the IEP matter more than ever. In class: <b>accommodations</b> keep the same standard (grade normally); <b>modifications</b> change it (grade against it and say so).</p>
</section>

<section>
  <h2>In the classroom: layer the supports</h2>
  <div class="ho-pillars">
    <div><b>UDL</b><span>For all: many ways to engage, represent (visuals, text-to-speech, glossaries) and express (oral, drawn, typed)</span></div>
    <div><b>Integrated ELD</b><span>For all ELs: language objectives, frames by level, structured partner talk, word walls with cognates</span></div>
    <div><b>Designated ELD</b><span>Protected time with the ELD standards. Never traded for resource or pull-out time.</span></div>
    <div><b>IEP supports</b><span>For the individual: accommodations, specialized instruction, related services, LAGOS progress monitoring</span></div>
  </div>
  <p class="ho-note"><b>Scheduling watch-out:</b> a dually identified student should not lose designated ELD because they were scheduled into a resource period or SPED elective. Both services belong in the schedule.</p>
  <h3 class="ho-group">Moves that work for dually identified middle schoolers</h3>
  <ol class="ho-list">
    <li><b>Teach academic vocabulary intensively</b> over several days (strong evidence, IES/WWC 2014). Pre-teach with visuals, gestures, examples and non-examples, and L1 cognates. Daily 15-minute interactive vocabulary helped 6th graders with LD keep words 4–24 weeks later.</li>
    <li><b>Integrate oral and written English</b> into content teaching (strong evidence). Many grades 6–8 ELs with disabilities need explicit oral-language work, not just reading skills.</li>
    <li><b>Chunk tasks and texts:</b> one step at a time, written + oral + visual.</li>
    <li><b>Model and think aloud</b>, then guided practice, then independent work.</li>
    <li><b>Graphic organizers</b> for reading, writing and math.</li>
    <li><b>Sentence frames</b> matched to both the ELD level and the IEP needs.</li>
    <li><b>Wait time</b> and a trusted talk partner (they may be translating in their head).</li>
    <li><b>Allow L1</b> for thinking, notes and drafting.</li>
    <li><b>Frequent, low-stakes checks</b>: whiteboards, thumbs, exit tickets.</li>
    <li><b>Belonging and self-advocacy:</b> affirm their bilingualism and teach "Can I hear the directions again?" and "Can I explain it orally?"</li>
  </ol>
  <p class="ho-note"><b>Collaborate:</b> gen ed, SPED and ELD teachers co-plan around both the IEP goals and the ELD standards, share ELPAC + IEP + classroom data, and keep students in general education with English-proficient peers as much as appropriate (avoid linguistic segregation).</p>
</section>

<section class="ho-try">
  <h2>Try this week</h2>
  <ul class="ho-check">
    <li>Find your dually identified students and read their IEPs: is their EL status, ELPAC data and ELD service listed?</li>
    <li>Check their schedules: is anyone missing designated ELD?</li>
    <li>Add one layer of support (a frame, a visual, wait time) for one student in your next lesson.</li>
    <li>Before your next IEP meeting, confirm a qualified interpreter, not a family member.</li>
    <li>Questions about a student's plan? Come find Ms. Williams!</li>
  </ul>
</section>

<footer class="ho-sources">
  <h2>Sources</h2>
  <ol>
    <li>California Department of Education (2019). <i>California Practitioners' Guide for Educating English Learners with Disabilities.</i></li>
    <li>Artiles, A. &amp; Souto-Maior, J. <i>Multilingual Learners of English with Disabilities in California.</i> Getting Down to Facts / Stanford.</li>
    <li>Californians Together (2015). <i>Long-Term English Learners, Phase II report.</i></li>
    <li>U.S. Dept. of Education &amp; Dept. of Justice (2015). Dear Colleague Letter, Section F (rescinded 2025; Title VI, IDEA and EEOA still apply).</li>
    <li>California Education Code §56345 (LAGOS) and §56341.5 (interpreters at IEP meetings); 5 CCR §3001.</li>
    <li>CDE / ETS. <i>ELPAC Accessibility Resources and Domain Exemption</i>; <i>Alternate Assessment Participation Decision-Making Tool</i>; Reclassification FAQs (AB 2555).</li>
    <li>IES / What Works Clearinghouse (2014). <i>Teaching Academic Content and Literacy to English Learners in Elementary and Middle School.</i></li>
    <li>O'Connor et al. Vocabulary instruction for middle school students with learning disabilities; Hovey et al. (2019), <i>Preventing School Failure.</i></li>
    <li>Jung, L. A. &amp; Guskey, T. R. (2010). "Grading Exceptional Learners." <i>Educational Leadership.</i></li>
    <li>EdSource (2023); LAist: translation of special education documents for families.</li>
  </ol>
</footer>`;
