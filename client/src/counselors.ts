/**
 * The Counselors' Office (the ground-floor office door inside campus, under the music room). There are no characters to
 * walk up to: pressing E at the door opens the office, where the three counselors can be talked to in dialogue windows:
 * Ms. Chavez (lead counselor), Ms. Sosa and Ms. Mendez.
 *
 * Content: assets/Counselors-Supporting-MLLs-Room-Blueprint.md (Olsen / Californians Together Counselor Toolkit 2025;
 * ASCA; U.S. ED Newcomer Toolkit; ELRD Center 2023; Ed Code §234.7, §48985; Plyler v. Doe; CDE on AB 2555). Each
 * counselor covers a third of it: Ms. Chavez the big picture, typologies and social-emotional support; Ms. Sosa
 * placement, scheduling and reclassification; Ms. Mendez families, immigration protections and transitions.
 */
import type { DialogTree, DialogSpeaker } from "./dialog";
import chavezPortrait from "./assets/chavez_portrait.png";
import sosaPortrait from "./assets/sosa_portrait.png";
import mendezPortrait from "./assets/mendez_portrait.png";

export const COUNSELORS_DOOR = { x: -26, z: -10.5 };

type Talk = { speaker: DialogSpeaker; tree: DialogTree };

export const COUNSELORS_OFFICE: Talk = {
  speaker: { name: "Counselors' Office", title: "Valor Academy · Counseling" },
  tree: {
    start: "root",
    nodes: {
      root: {
        paragraphs: [
          "You open the door to the Counselors' Office. It's calm and cozy in here, with a bowl of fidgets on the table and posters about kindness and goals on the walls.",
          "Ms. Chavez, Ms. Sosa and Ms. Mendez wave hello. Who would you like to talk to?",
        ],
        options: [
          { label: "Talk to Ms. Chavez (Lead Counselor)", action: "counsel:chavez" },
          { label: "Talk to Ms. Sosa", action: "counsel:sosa" },
          { label: "Talk to Ms. Mendez", action: "counsel:mendez" },
          { label: "Leave the office" },
        ],
      },
    },
  },
};

/** The options every counselor offers at the end of a conversation: talk to another counselor, or leave */
const others = (me: "chavez" | "sosa" | "mendez") =>
  [
    me !== "chavez" ? { label: "Can I talk to Ms. Chavez?", action: "counsel:chavez" } : null,
    me !== "sosa" ? { label: "Can I talk to Ms. Sosa?", action: "counsel:sosa" } : null,
    me !== "mendez" ? { label: "Can I talk to Ms. Mendez?", action: "counsel:mendez" } : null,
  ].filter((x): x is { label: string; action: string } => !!x);

/** The usual "ask something else / thanks" pair after an answer */
const more = (name: string) => [
  { label: "I have another question", next: "root" },
  { label: `Thanks, ${name}!`, next: "bye" },
];

export const CHAVEZ: Talk = {
  speaker: { name: "Ms. Chavez", title: "Lead Counselor", portrait: chavezPortrait },
  tree: {
    start: "root",
    nodes: {
      root: {
        paragraphs: [
          "Hi, welcome in! I'm Ms. Chavez, the lead counselor. With our multilingual learners, we cover three areas: their academics, their college and career path, and their social-emotional well-being.",
        ],
        options: [
          { label: "Why do counselors matter so much for MLLs?", next: "why" },
          { label: "Aren't English learners all pretty similar?", next: "types" },
          { label: "How do you support students emotionally?", next: "sel" },
          ...others("chavez"),
          { label: "Thanks, Ms. Chavez!", next: "bye" },
        ],
      },
      why: {
        paragraphs: [
          "Access! In one study, English learners in schools with counselor time were more likely to be enrolled in core English and math classes than those in schools without a counselor.",
          "But California averages about 432 students per counselor, and the recommendation is 250. We can't do it alone, so we build systems: data dashboards, scheduling rules, teacher referrals and family liaisons. Every teacher is part of it.",
        ],
        options: more("Ms. Chavez"),
      },
      types: {
        paragraphs: [
          "Not at all! Newcomers with strong schooling need acceleration, not waiting. Students with interrupted schooling need intensive literacy and math support. Long-term English learners, often born here and socially fluent, need goal-setting and academic language. Some also have an IEP, and reclassified students are monitored for four years.",
          "Their lives matter too: culture shock, trauma, family separation, working or interpreting for their parents. About 1 in 5 California kids lives in a mixed-status household.",
        ],
        options: more("Ms. Chavez"),
      },
      sel: {
        paragraphs: [
          "In tiers. For everyone: a welcoming, culturally affirming school with peer buddies. For some: newcomer and long-term EL groups and regular check-ins with a trusted adult. For a few: individual counseling and referrals to bilingual mental health services.",
          "And trauma-informed habits in every classroom: predictable routines, a heads-up before fire drills, relationships first, and never forcing a student to share their immigration story. What looks like misbehavior can be a stress response.",
        ],
        options: more("Ms. Chavez"),
      },
      bye: {
        paragraphs: ["Our door is always open. Have a great day!"],
        options: [{ label: "Bye, Ms. Chavez!" }, ...others("chavez")],
      },
    },
  },
};

export const SOSA: Talk = {
  speaker: { name: "Ms. Sosa", title: "Counselor", portrait: sosaPortrait },
  tree: {
    start: "root",
    nodes: {
      root: {
        paragraphs: ["Hey, hi! I'm Ms. Sosa, one of the counselors. I do a lot of the scheduling and placement for our English learners."],
        options: [
          { label: "How do you build an English learner's schedule?", next: "schedule" },
          { label: "How do you place a new arrival?", next: "place" },
          { label: "How do you help with reclassification?", next: "reclass" },
          ...others("sosa"),
          { label: "Thanks, Ms. Sosa!", next: "bye" },
        ],
      },
      schedule: {
        paragraphs: [
          "English learners can't be kept out of core classes, a full course load, advanced classes or electives. We schedule ELD first, then build everything else around it.",
          "And we avoid the \"ESL ghetto,\" where the same group of English learners is together all day. We don't mix newcomers and long-term English learners in ELD, and electives like music and robotics are a priority, because that's where belonging happens.",
        ],
        options: more("Ms. Sosa"),
      },
      place: {
        paragraphs: [
          "It depends on the student. A newcomer with strong schooling gets a transcript review and grade-level or even advanced classes with home-language resources. Accelerate, don't remediate: their time is precious.",
          "A student with interrupted schooling might start in a newcomer class with double ELD. And if a disability is a question, the student study team asks: did they get good ELD, and does the difficulty show up in both languages?",
        ],
        options: more("Ms. Sosa"),
      },
      reclass: {
        paragraphs: [
          "With goal-setting conferences, especially for our 7th and 8th grade long-term English learners. We look at their ELPAC scores by domain and set goals together. Under AB 2555, the ELPAC is now the only reclassification criterion.",
          "Labels carry feelings, so we call it being \"on the path to biliteracy,\" not a deficit. And after students reclassify, we keep an eye on their grades for four years.",
        ],
        options: more("Ms. Sosa"),
      },
      bye: {
        paragraphs: ["Take care! Come back anytime."],
        options: [{ label: "Bye, Ms. Sosa!" }, ...others("sosa")],
      },
    },
  },
};

export const MENDEZ: Talk = {
  speaker: { name: "Ms. Mendez", title: "Counselor", portrait: mendezPortrait },
  tree: {
    start: "root",
    nodes: {
      root: {
        paragraphs: ["Hi there! I'm Ms. Mendez, one of the counselors. I work a lot with our families and with students' plans for the future."],
        options: [
          { label: "How do you work with families?", next: "families" },
          { label: "What if a family is worried about immigration?", next: "rights" },
          { label: "What about high school and college?", next: "future" },
          ...others("mendez"),
          { label: "Thanks, Ms. Mendez!", next: "bye" },
        ],
      },
      families: {
        paragraphs: [
          "Families are our partners and the experts on their child. We use qualified interpreters, never a student or sibling, and translate key documents. When 15% of our students share a language, notices go home in that language too.",
          "We hold family nights in home languages to explain grades, credits, the ELPAC and reclassification, offer evening and phone meetings, and invite families to our English Learner Advisory Committee.",
        ],
        options: more("Ms. Mendez"),
      },
      rights: {
        paragraphs: [
          "Every child has the right to a free public education, regardless of immigration status (Plyler v. Doe). In California, schools don't collect immigration status, and we can't share a student's information with immigration enforcement without parent consent or a court order.",
          "We share \"Know Your Educational Rights\" guides in home languages, help families with emergency contact plans if they ask, and refer them to trusted legal services. We don't give legal advice ourselves.",
        ],
        options: more("Ms. Mendez"),
      },
      future: {
        paragraphs: [
          "It starts in middle school! Our 7th and 8th grade English learners set goals, learn about college, A–G classes and financial aid in their home language, and explore careers where being bilingual is a strength, on the path to the State Seal of Biliteracy.",
          "For 8th graders, we send each high school an EL student profile, meet with their counselors, and hold a \"Welcome to High School\" night in home languages, so no one gets automatically tracked into lower classes.",
        ],
        options: more("Ms. Mendez"),
      },
      bye: {
        paragraphs: ["Have a wonderful day! Remember to take care of yourself too."],
        options: [{ label: "Bye, Ms. Mendez!" }, ...others("mendez")],
      },
    },
  },
};
