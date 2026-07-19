import React from 'react';
import {
  FaHtml5,
  FaReact,
  FaVuejs,
  FaPython,
  FaJava,
  FaNodeJs,
} from 'react-icons/fa';
import {
  SiSolidity,
  SiCplusplus,
  SiNextdotjs,
  SiBun,
  SiGo,
  SiC,
} from 'react-icons/si';
import PlaygroundCard from './PlaygroundCard';

const frameworks = [
  {
    id: 'html-css',
    icon: <FaHtml5 className="w-8 h-8 text-primary" />,
    title: 'HTML/CSS',
    description: 'Vanilla HTML/CSS/JS playground',
    href: '/editor',
  },
  {
    id: 'react',
    icon: <FaReact className="w-8 h-8 text-primary" />,
    title: 'React',
    description: 'React playground using Vite',
    href: '/editor?template=react',
  },
  {
    id: 'vue',
    icon: <FaVuejs className="w-8 h-8 text-primary" />,
    title: 'Vue 3',
    description: 'Vue 3 playground using Vite',
  },
  {
    id: 'solidity',
    icon: <SiSolidity className="w-8 h-8 text-primary" />,
    title: 'Solidity',
    description: 'Hardhat based solidity playground',
  },
  {
    id: 'python',
    icon: <FaPython className="w-8 h-8 text-primary" />,
    title: 'Python',
    description: 'Python 3 playground',
  },
  {
    id: 'java',
    icon: <FaJava className="w-8 h-8 text-primary" />,
    title: 'Java',
    description: 'Java playground',
  },
  {
    id: 'golang',
    icon: <SiGo className="w-8 h-8 text-primary" />,
    title: 'Golang',
    description: 'Golang playground',
  },
  {
    id: 'nodejs',
    icon: <FaNodeJs className="w-8 h-8 text-primary" />,
    title: 'Node.js',
    description: 'Node.js 18 playground',
  },
  {
    id: 'cpp',
    icon: <SiCplusplus className="w-8 h-8 text-primary" />,
    title: 'C++',
    description: 'C++ playground',
  },
  {
    id: 'c',
    icon: <SiC className="w-8 h-8 text-primary" />,
    title: 'C',
    description: 'C playground',
  },
  {
    id: 'nextjs',
    icon: <SiNextdotjs className="w-8 h-8 text-primary" />,
    title: 'Next.js',
    description: 'Next.js 14 playground',
  },
  {
    id: 'bun',
    icon: <SiBun className="w-8 h-8 text-primary" />,
    title: 'Bun',
    description: 'Bun playground',
  },
];

export default function PlaygroundCards() {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
        {frameworks.map((framework) => (
          <PlaygroundCard
            key={framework.id}
            icon={framework.icon}
            title={framework.title}
            description={framework.description}
            href={framework.href ?? `/playground/${framework.id}`}
          />
        ))}
      </div>
    </div>
  );
}
