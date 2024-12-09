
# VideoInterleaving

VideoInterleaving is a platform designed for artists to create dynamic and synchronized video installations. By leveraging PNG/WebP image sequences, it ensures minimal decoding time and offers flexibility through random data generation. It's a quick and efficient solution for creating responsive, high-quality video art installations in JavaScript.

## Features

### Frame-by-Frame Switching
Switch between video sequence frames seamlessly using internal or external timecode sequencers for precise synchronization.

### Optimized Image Sequences
Uses image sequences (PNG/WebP) to eliminate decoding delays, enabling instant source changes.

### Transparency Support
Fully supports transparency in video sequences, even on low-performance hardware.

### Hybrid Operation Modes
Operate in standalone or hybrid modes depending on your project's needs.

### Server Functionality
Includes optional server capabilities for remote control or distributed setups.

## Requirements

- **Software:**  
  - Node.js (with npm)  
  - A modern browser that supports JavaScript and HTML5

- **Hardware:**  
  - A reasonably fast storage solution for handling large image sequences efficiently

## Installation

### Clone the Repository

```bash
git clone <repository-url>
cd VideoInterleaving
```

### Install Dependencies

Use npm to install the required dependencies:

```bash
npm install
```

### Build the Project

Bundle and optimize the JavaScript and CSS files:

```bash
npm run build
```

### Prepare Image Sequences

Store your PNG/WebP sequences in a dedicated folder. Update any configuration files to point to this location if necessary.

### Run the Project

Open `index.html` in your preferred browser to start the application.

## Usage

### Modes of Operation

#### Standalone Mode
Runs the project independently without external synchronization.

#### Hybrid Mode
Combines standalone features with optional server functionality for distributed setups.

### Running the Application

1. Open `index.html` in a browser.
2. Follow on-screen instructions or configure options in the code as needed.

## Contributing

VideoInterleaving is a work-in-progress, originally created for specific artistic needs. Contributions are welcome to improve functionality, generalize its use cases, and enhance code quality.

### To contribute:

1. Fork the repository.
2. Create a feature branch.
3. Submit a pull request with a clear explanation of your changes.

## Authors

- **Ben Gencarelle**  
  Original creator and developer of the project.  
  [Ben's YouTube Page](https://www.youtube.com/your-channel)

- **ChatGPT**  
  Contributor to the documentation and optimization process.

## Demos

Explore demos of VideoInterleaving in action on Ben's YouTube page.

## License

This project is licensed under [LICENSE_NAME]. Replace this with the appropriate license type (e.g., MIT, Apache, GPL).
