// pages/Support.tsx
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, Phone, Clock, FileText, Shield, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { useToast } from "@/hooks/use-toast";

const Support = () => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: ""
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // For now, I'll just show a success message
    // then later i can  add Resend email integration later
    toast({
      title: "Message sent!",
      description: "We'll get back to you within 24 hours.",
      variant: "default",
    });
    
    setFormData({ name: "", email: "", subject: "", message: "" });
  };

  const faqItems = [
    {
      question: "What is your typical response time?",
      answer: "We aim to respond to all support inquiries within 24 hours during business days."
    },
    {
      question: "Do you provide technical support?",
      answer: "Yes, we provide technical support for all issues related to Studese Pro."
    },
    {
      question: "Can I request new features?",
      answer: "Absolutely! We welcome feature requests and feedback to improve our service."
    },
    {
      question: "Is there documentation available?",
      answer: "Yes, comprehensive documentation is available in the help section of your dashboard."
    }
  ];

  return (
    <Layout>
      <div className="p-6 space-y-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">Support Center</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            We're here to help you get the most out of Studese Pro. Reach out to us anytime.
          </p>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Contact Information & Links - Left Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <Mail className="h-5 w-5 text-primary" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-lg border">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">Email</p>
                    <a 
                      href="mailto:StudeseDatadept@gmail.com" 
                      className="text-primary hover:underline text-sm"
                    >
                      StudeseDatadept@gmail.com
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg border">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">Phone</p>
                    <a 
                      href="tel:204-333-4080" 
                      className="text-primary hover:underline text-sm"
                    >
                      204-333-4080
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg border">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">Response Time</p>
                    <p className="text-sm text-muted-foreground">Within 24 hours</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Links */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Quick Links</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start gap-2" asChild>
                  <Link to="/terms">
                    <FileText className="h-4 w-4" />
                    Terms of Service
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2" asChild>
                  <Link to="/privacy">
                    <Shield className="h-4 w-4" />
                    Privacy Policy
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2" asChild>
                  <Link to="/resources">
                    <BookOpen className="h-4 w-4" />
                    Resources
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Contact Form & FAQ - Right Side */}
          <div className="lg:col-span-2 space-y-8">
            {/* Contact Form */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Send us a Message</CardTitle>
                <p className="text-muted-foreground">
                  Fill out the form below and we'll get back to you as soon as possible.
                </p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        placeholder="Your full name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="your.email@example.com"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject</Label>
                    <Input
                      id="subject"
                      name="subject"
                      value={formData.subject}
                      onChange={handleInputChange}
                      placeholder="Brief description of your issue"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">Message</Label>
                    <Textarea
                      id="message"
                      name="message"
                      value={formData.message}
                      onChange={handleInputChange}
                      placeholder="Please describe your issue in detail..."
                      rows={5}
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full">
                    Send Message
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* FAQ Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Frequently Asked Questions</CardTitle>
                <p className="text-muted-foreground">
                  Quick answers to common questions
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {faqItems.map((faq, index) => (
                    <div key={index} className="border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                      <h3 className="font-semibold mb-2 text-sm">{faq.question}</h3>
                      <p className="text-muted-foreground text-sm">{faq.answer}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Support;
