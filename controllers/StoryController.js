import Story from "../db/schema/StorySchema.js";
import User from "../db/schema/UserSchema.js";
import { generateImage } from "../openai/generateImage.js";
import { generateStory } from "../openai/generateStory.js";
import { v2 as cloudinary } from "cloudinary";
// For downloading images if needed

const createStoryController = async (req, res) => {
  try {
    const { storyDescription, storyTitle, maxPages, includeImage, childAge } =
      req.body;

    const userId = req.user._id;
    const author = req.user.parentName;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const storyData = await generateStory({
      storyDescription,
      storyTitle,
      maxPages,
      includeImage,
      childAge,
    });

    let storyContents = [];
    let cnt = 0;

    for (let i = 0; i < maxPages; i++) {
      let pageImage = null;
      const pageText = storyData.storyContent[i].pageText;

      if (includeImage && (cnt == 0 || cnt == 2)) {
        const generatedImageUrl = await generateImage({ pageText });

        if (generatedImageUrl) {
          // Optionally download the image if necessary
          const uploadedImage = await cloudinary.uploader.upload(
            generatedImageUrl
          );

          pageImage = uploadedImage.secure_url; // Cloudinary-secured URL
        }
      }
      cnt++;

      // Add the page content and image to the storyContent array
      storyContents.push({ pageText, pageImage });
    }

    // Return the generated story and content in the response
    const story = new Story({
      storyTitle,
      storyDescription,
      storyContent: storyContents,
      storyAuthor: author,
      createdBy: userId,
      maxPages,
    });

    await story.save();
    return res.status(201).json({
      message: "Story created successfully",
      story,
    });
  } catch (error) {
    console.error("Error generating story:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to generate story" });
  }
};

const getStoryController = async (req, res) => {
  const { sid } = req.params;

  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const story = await Story.findById(sid);
    if (!story) {
      return res.status(404).json({ message: "Story not found" });
    }

    if (story.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    return res.status(200).json({ story });
  } catch (error) {
    console.error("Error getting story:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export { createStoryController, getStoryController };