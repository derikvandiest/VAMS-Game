/**
 * The Counselors' Office (the ground-floor office door inside campus, under the music room). There are no characters to
 * walk up to: pressing E at the door opens the office, where the three counselors can be talked to in dialogue windows:
 * Ms. Chavez (lead counselor), Ms. Sosa and Ms. Mendez. All text here is SAMPLE text for now.
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

export const CHAVEZ: Talk = {
  speaker: { name: "Ms. Chavez", title: "Lead Counselor", portrait: chavezPortrait },
  tree: {
    start: "root",
    nodes: {
      root: {
        paragraphs: [
          "(Sample text) Hi, welcome in! I'm Ms. Chavez, the lead counselor. I'm so glad you stopped by.",
          "Our team supports students' social-emotional well-being, their academics, and their plans for the future.",
        ],
        options: [
          { label: "What does a lead counselor do?", next: "lead" },
          { label: "How do you support newcomer students?", next: "newcomers" },
          ...others("chavez"),
          { label: "Thanks, Ms. Chavez!", next: "bye" },
        ],
      },
      lead: {
        paragraphs: [
          "(Sample text) Besides my own students, I coordinate our counseling team: the schedules, school-wide lessons on things like kindness and goal setting, our student support meetings, and how we respond when a student is in crisis.",
          "I also make sure every student has at least one adult on campus they trust.",
        ],
        options: [
          { label: "I have another question", next: "root" },
          { label: "Thanks, Ms. Chavez!", next: "bye" },
        ],
      },
      newcomers: {
        paragraphs: [
          "(Sample text) We meet with every newcomer in their first week, with an interpreter if needed, and pair them with a buddy who speaks their language.",
          "Moving to a new country is a big change. We check in often, connect families with Mr. Martinez for community resources, and work closely with the ELD teachers.",
        ],
        options: [
          { label: "I have another question", next: "root" },
          { label: "Thanks, Ms. Chavez!", next: "bye" },
        ],
      },
      bye: {
        paragraphs: ["(Sample text) Our door is always open. Have a great day!"],
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
        paragraphs: ["(Sample text) Hey, hi! I'm Ms. Sosa, one of the counselors. Come on in!"],
        options: [
          { label: "What do you work on with students?", next: "work" },
          { label: "How can teachers help?", next: "teachers" },
          ...others("sosa"),
          { label: "Thanks, Ms. Sosa!", next: "bye" },
        ],
      },
      work: {
        paragraphs: [
          "(Sample text) A little bit of everything: friendship problems, stress, grades, and helping students set goals and find what they're good at.",
          "We also run small groups at lunch, like a newcomers' group where students can talk in English and in their home language.",
        ],
        options: [
          { label: "I have another question", next: "root" },
          { label: "Thanks, Ms. Sosa!", next: "bye" },
        ],
      },
      teachers: {
        paragraphs: [
          "(Sample text) You know your students best! If a student seems quiet, upset, or different than usual, send us a referral or just come find us.",
          "For English learners, remember that silence can be part of learning a new language. Give them time, visuals, and a friendly partner.",
        ],
        options: [
          { label: "I have another question", next: "root" },
          { label: "Thanks, Ms. Sosa!", next: "bye" },
        ],
      },
      bye: {
        paragraphs: ["(Sample text) Take care! Come back anytime."],
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
        paragraphs: ["(Sample text) Hi there! I'm Ms. Mendez, one of the counselors. How are you doing today?"],
        options: [
          { label: "How do you work with families?", next: "families" },
          { label: "What about high school and college?", next: "future" },
          ...others("mendez"),
          { label: "Thanks, Ms. Mendez!", next: "bye" },
        ],
      },
      families: {
        paragraphs: [
          "(Sample text) Families are our partners. We call home with good news too, not only when there's a problem, and we always offer an interpreter so families can share in their own language.",
        ],
        options: [
          { label: "I have another question", next: "root" },
          { label: "Thanks, Ms. Mendez!", next: "bye" },
        ],
      },
      future: {
        paragraphs: [
          "(Sample text) It's never too early to dream! We help our 8th graders choose their high school and classes, and every grade learns about college and careers. That's why our homerooms are named after universities.",
        ],
        options: [
          { label: "I have another question", next: "root" },
          { label: "Thanks, Ms. Mendez!", next: "bye" },
        ],
      },
      bye: {
        paragraphs: ["(Sample text) Have a wonderful day! Remember to take care of yourself too."],
        options: [{ label: "Bye, Ms. Mendez!" }, ...others("mendez")],
      },
    },
  },
};
