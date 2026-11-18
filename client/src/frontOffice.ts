/**
 * The front office (glass double doors on the office building's west side, by the parking lot). There are no characters
 * to walk up to: pressing E at the doors opens the front desk, where Nancy and Johanna (front office staff) can be talked
 * to in dialogue windows. All text here is SAMPLE text for now.
 */
import type { DialogTree, DialogSpeaker } from "./dialog";
import nancyPortrait from "./assets/nancy_portrait.png";
import johannaPortrait from "./assets/johanna_portrait.png";

export const FRONT_OFFICE_DOOR = { x: -30, z: -15.25 };

export const FRONT_DESK: { speaker: DialogSpeaker; tree: DialogTree } = {
  speaker: { name: "Front Office", title: "Valor Academy · Administration" },
  tree: {
    start: "root",
    nodes: {
      root: {
        paragraphs: [
          "You step into the front office. Nancy and Johanna look up from the front desk and smile.",
          "Who would you like to talk to?",
        ],
        options: [
          { label: "Talk to Nancy", action: "office:nancy" },
          { label: "Talk to Johanna", action: "office:johanna" },
          { label: "Leave the office" },
        ],
      },
    },
  },
};

export const NANCY: { speaker: DialogSpeaker; tree: DialogTree } = {
  speaker: { name: "Nancy", title: "Front Office", portrait: nancyPortrait },
  tree: {
    start: "root",
    nodes: {
      root: {
        paragraphs: [
          "(Sample text) Hi, welcome to Valor! I'm Nancy, here at the front desk. How can I help you today?",
        ],
        options: [
          { label: "I'm here for the PD. Where do I go?", next: "pd" },
          { label: "What does the front office do?", next: "role" },
          { label: "I lost something", next: "lost" },
          { label: "Can I talk to Johanna?", action: "office:johanna" },
          { label: "Thanks, Nancy!", next: "bye" },
        ],
      },
      pd: {
        paragraphs: [
          "(Sample text) Welcome! Everyone starts in the MPR: head through the main gate and it's the big building on your right. Take a seat at one of the tables.",
          "After that, visit the classrooms to complete their assignments. Your map (press M) and your student agenda will keep you on track.",
        ],
        options: [
          { label: "I have another question", next: "root" },
          { label: "Thanks, Nancy!", next: "bye" },
        ],
      },
      role: {
        paragraphs: [
          "(Sample text) We're the first stop for everyone: families, visitors, students and staff. We check in visitors, answer the phones, take attendance calls, and help families with anything they need.",
          "And we always make sure families can talk to us in their language. That's a big part of making our school feel welcoming.",
        ],
        options: [
          { label: "I have another question", next: "root" },
          { label: "Thanks, Nancy!", next: "bye" },
        ],
      },
      lost: {
        paragraphs: [
          "(Sample text) Oh no! Check the lost and found here in the office first. If it was your Stanley cup, Delma at the food truck by the MPR has new ones.",
        ],
        options: [
          { label: "I have another question", next: "root" },
          { label: "Thanks, Nancy!", next: "bye" },
        ],
      },
      bye: {
        paragraphs: ["(Sample text) You're welcome! Have a great day at Valor!"],
        options: [{ label: "Bye, Nancy!" }],
      },
    },
  },
};

export const JOHANNA: { speaker: DialogSpeaker; tree: DialogTree } = {
  speaker: { name: "Johanna", title: "Front Office", portrait: johannaPortrait },
  tree: {
    start: "root",
    nodes: {
      root: {
        paragraphs: [
          "(Sample text) Hello! I'm Johanna, from the front office. It's great to have you on campus today. What can I do for you?",
        ],
        options: [
          { label: "How do you help new families?", next: "families" },
          { label: "Who do I ask about the gates?", next: "gates" },
          { label: "Can I talk to Nancy?", action: "office:nancy" },
          { label: "Thanks, Johanna!", next: "bye" },
        ],
      },
      families: {
        paragraphs: [
          "(Sample text) When a new family arrives, often a newcomer family, I help them enroll, fill out the forms, and get connected: the home language survey, school supplies, lunch, transportation.",
          "Then I introduce them to Mr. Martinez, our Community Schools Manager, so they know about the resources and the ELAC. That first visit sets the tone for the whole year.",
        ],
        options: [
          { label: "I have another question", next: "root" },
          { label: "Thanks, Johanna!", next: "bye" },
        ],
      },
      gates: {
        paragraphs: [
          "(Sample text) Ms. Castaneda runs the front entrance gate, and Mr. Navarro runs the car gate. Just ask them and they'll open it for you!",
        ],
        options: [
          { label: "I have another question", next: "root" },
          { label: "Thanks, Johanna!", next: "bye" },
        ],
      },
      bye: {
        paragraphs: ["(Sample text) Anytime! Enjoy the PD."],
        options: [{ label: "Bye, Johanna!" }],
      },
    },
  },
};
