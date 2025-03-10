from setuptools import setup, find_packages

with open("requirements.txt") as f:
    install_requires = f.read().strip().split("\n")

setup(
    name="ebot",
    version="0.0.1",
    description="Ebot",
    author="vinay",
    author_email="reddysrivinayofficial@gmail.com",
    packages=find_packages(),
    zip_safe=False,
    include_package_data=True,
    install_requires=[
        "frappe>=15.0.0",
        "openai==0.27.8",
        "numpy",
        "requests",
        "Pillow"
    ],
    python_requires=">=3.10",
)
