# PCCC Chatbot - Fire Safety Compliance Assistant

A Next.js-based chatbot application for fire safety compliance (PCCC) assistance, providing expert guidance on Vietnamese fire protection laws and building safety requirements.

## Features

- 🔥 **Fire Safety Expertise**: Specialized in PCCC (Phòng cháy chữa cháy) regulations
- 📄 **PDF Document Processing**: Upload and analyze fire safety documents
- 🤖 **AI-Powered Responses**: Uses OpenAI GPT models for intelligent responses
- 🇻🇳 **Vietnamese Language Support**: Fully localized for Vietnamese users
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🚀 **Modern Tech Stack**: Built with Next.js, TypeScript, and Tailwind CSS

## Tech Stack

### Frontend

- **Next.js 15** with App Router
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Lucide React** for icons

### Backend (API Routes)

- **Next.js API Routes** (migrated from FastAPI)
- **LangChain** for document processing
- **OpenAI GPT** for AI responses
- **PDF parsing** for document analysis
- **Vector search** with fallback to text search

## Project Structure

```
pccc-chatbot/
├── src/
│   ├── app/
│   │   ├── api/           # API routes (backend)
│   │   │   ├── health/    # Health check endpoint
│   │   │   ├── query/     # Chat query endpoint
│   │   │   └── upload-pdf/# PDF upload endpoint
│   │   ├── globals.css    # Global styles
│   │   ├── layout.tsx     # Root layout
│   │   └── page.tsx       # Main page
│   ├── components/
│   │   └── ChatInterface.tsx  # Main chat component
│   ├── lib/
│   │   └── fileUtils.ts   # File handling utilities
│   ├── services/
│   │   └── pdfProcessingService.ts  # PDF processing logic
│   └── types/
│       └── index.ts       # TypeScript type definitions
├── uploads/               # Uploaded PDF storage
├── .env.local            # Environment variables
└── package.json          # Dependencies
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- OpenAI API key

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd pccc-chatbot
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file in the root directory:

   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   NODE_ENV=development
   ```

4. **Run the development server**

   ```bash
   npm run dev
   ```

5. **Open the application**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Usage

### Basic Workflow

1. **Upload PDF Document**: Click the upload button to upload a PCCC PDF document
2. **Wait for Processing**: The system will process the document and create vector embeddings
3. **Start Chatting**: Ask questions about fire safety regulations and compliance
4. **Get Expert Answers**: Receive detailed responses based on the uploaded document

### Example Questions (in Vietnamese)

- "Quy định về hệ thống báo cháy trong tòa nhà cao tầng là gì?"
- "Khoảng cách an toàn giữa các lối thoát hiểm?"
- "Yêu cầu về thiết bị chữa cháy trong nhà máy?"

## API Endpoints

### Health Check

- **GET** `/api/health`
- Returns system status and PDF upload state

### Upload PDF

- **POST** `/api/upload-pdf`
- Upload and process PCCC PDF documents
- Accepts: `multipart/form-data` with PDF file

### Query Chat

- **POST** `/api/query`
- Send chat messages and get AI responses
- Body: `{ "question": "your question here" }`

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

### Key Components

#### ChatInterface

The main chat component handling:

- Message display and management
- File upload functionality
- Real-time communication with API
- Loading states and error handling

#### PdfProcessingService

Core service for:

- PDF parsing and text extraction
- Document chunking for processing
- Vector store creation with OpenAI embeddings
- Fallback to simple text search
- Query processing with LLM

## Migration from FastAPI

This project was migrated from a FastAPI backend to Next.js API routes for:

- **Unified codebase**: Single repository for frontend and backend
- **Better deployment**: Simplified deployment with Vercel/other platforms
- **TypeScript consistency**: End-to-end TypeScript support
- **Improved development experience**: Hot reloading for both frontend and backend

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.
