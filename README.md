# The Sound of a Name

The Sound of a Name is a generative music project that turns a person's name into a unique musical composition.

Instead of assigning random sounds, every letter follows a mathematical rule based on the Fibonacci sequence. Each letter generates its own looping pattern, which becomes a sequence of recorded human sounds. The result is a composition that is completely determined by the name, while still sounding different for every person.

The project explores the idea that a name can be read as a mathematical system rather than just a word.

## How it works

1. Enter a name.
2. Each letter is converted into its alphabet value (A = 1, B = 2, ... Z = 26).
3. A Fibonacci-modulo sequence is generated for every letter.
4. Every number in the sequence plays a recorded human sound.
5. The name also determines a time signature, percussion instrument, and suggested musical theme.
6. The website plays the composition and creates a visual loop that can be exported as a poster.

## Features

- Name-to-music generation using Fibonacci modulo mathematics
- 27 human-recorded sound samples
- Name-derived time signatures
- Six musical themes (Pop, Jazz, Rock, Classical, Reggae, and Indian Carnatic)
- Customisable tempo
- Replace default sounds with your own recordings
- High-resolution poster export with the generated loop artwork

## Running the project (on a Terminal)

1. Clone this repository (using git clone "repository url")
2. Install the dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

4. Open the local address shown in the terminal on a browser

## Built with

- Vite
- JavaScript
- Web Audio API
- HTML & CSS

## Why I made this

This project began as an exploration of whether a name could reveal hidden patterns through mathematics. Rather than creating pleasant background music, I wanted each name to produce something that felt personal, strange, and unexpected. The visual loop and the composition are both generated from the same mathematical system, making every output a unique interpretation of a person's name.
